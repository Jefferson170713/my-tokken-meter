import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { obterCotacao } from '../core/cambio.ts'
import { configPadrao, lerConfig, salvarConfig, validarConfig } from '../core/config.ts'
import { interpretarStatus } from '../core/conta.ts'
import { abrirDb } from '../core/db.ts'
import { ingerir } from '../core/ingest.ts'
import { parseLinha } from '../core/parser.ts'
import { limites } from '../core/periods.ts'
import { custo, precoDe, tabelaPadrao } from '../core/prices.ts'
import { historico, resumo } from '../core/summary.ts'

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'projects')
const TZ_ORIGINAL = process.env.TZ
after(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_ORIGINAL
})
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mtm-'))
function ambiente() {
  const logs = tmp()
  fs.cpSync(FIXTURES, logs, { recursive: true })
  const dados = tmp()
  return { logs, dados, db: abrirDb(dados) }
}
const linhaAssistente = (id: string, ts: string) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: ts,
    requestId: `req_${id}`,
    message: { id, model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 10 } },
  })

test('parser: ignora o que não é resposta e conta linha quebrada', () => {
  assert.equal(parseLinha('{"type":"user"}'), 'ignorar')
  assert.equal(
    parseLinha(JSON.stringify({ type: 'assistant', message: { model: '<synthetic>' } })),
    'ignorar',
  )
  assert.equal(parseLinha('{quebrado'), 'invalida')
  assert.equal(
    parseLinha(
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-10-31T00:00:00Z',
        message: { id: 'x', model: 'm' },
      }),
    ),
    'invalida',
  )
})

test('parser: escrita de cache sem detalhamento conta como 5 min', () => {
  const r = parseLinha(
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-10-31T00:00:00Z',
      message: { id: 'x', model: 'm', usage: { cache_creation_input_tokens: 400 } },
    }),
  )
  assert.ok(typeof r === 'object')
  assert.equal(r.cw5m, 400)
  assert.equal(r.cw1h, 0)
  assert.equal(r.reqId, '')
})

test('ingest: dedupe, subagentes, sintético e linha quebrada', () => {
  const { logs, db } = ambiente()
  const r = ingerir(db, logs)
  assert.equal(r.novas, 3) // 001 (repetida), 002 e 003 do subagente
  assert.equal(r.ignoradas, 1)
  const m1 = db
    .prepare("SELECT input, cw1h, cread FROM messages WHERE msg_id = 'msg_TESTE_001'")
    .get() as Record<string, number>
  assert.deepEqual({ ...m1 }, { input: 1000, cw1h: 2000, cread: 10000 })
  assert.equal(ingerir(db, logs).novas, 0) // reler não muda nada
})

test('ingest: linha sem \\n espera, arquivo apagado mantém o histórico', () => {
  const { logs, db } = ambiente()
  ingerir(db, logs)
  const novo = path.join(logs, 'proj-ficticio', 'novo.jsonl')
  fs.writeFileSync(novo, linhaAssistente('msg_TESTE_004', '2026-10-31T17:00:00Z'))
  assert.equal(ingerir(db, logs).novas, 0)
  fs.appendFileSync(novo, '\n')
  assert.equal(ingerir(db, logs).novas, 1)
  fs.rmSync(path.join(logs, 'proj-ficticio'), { recursive: true })
  ingerir(db, logs)
  assert.equal(Number((db.prepare('SELECT count(*) c FROM messages').get() as { c: number }).c), 4)
})

test('períodos: semana começa na segunda, no fuso local', () => {
  process.env.TZ = 'America/Sao_Paulo'
  const domingoNoite = Date.parse('2026-11-02T02:59:00Z') // dom 01/11 23:59 em São Paulo
  assert.equal(limites(domingoNoite).semana, Date.parse('2026-10-26T03:00:00Z'))
  assert.equal(limites(domingoNoite).mes, Date.parse('2026-11-01T03:00:00Z'))
  const segunda = Date.parse('2026-11-02T03:00:00Z')
  assert.equal(limites(segunda).semana, segunda)
  assert.equal(limites(segunda).dia, segunda)
})

test('períodos: virada do horário de verão (Lisboa)', () => {
  process.env.TZ = 'Europe/Lisbon'
  const depois = Date.parse('2026-10-25T12:00:00Z') // domingo 25/10, depois do fim do horário de verão
  // o verão só acaba às 02:00, então a meia-noite de 25/10 ainda é +01:00
  assert.equal(limites(depois).dia, Date.parse('2026-10-24T23:00:00Z'))
  assert.equal(limites(Date.parse('2026-10-26T12:00:00Z')).dia, Date.parse('2026-10-26T00:00:00Z')) // já em +00:00
  assert.equal(limites(depois).semana, Date.parse('2026-10-18T23:00:00Z')) // seg 19/10 00:00 ainda em +01:00
})

test('preços: prefixo, modelo desconhecido e fast mode', () => {
  assert.equal(precoDe('claude-opus-5-5-20261001', tabelaPadrao), tabelaPadrao['claude-opus-5-5'])
  assert.equal(precoDe('modelo-inexistente', tabelaPadrao), null)
  const p = tabelaPadrao['claude-opus-5-5']
  const t = { input: 1_000_000, output: 0, cw5m: 0, cw1h: 0, cread: 0 }
  assert.equal(custo(t, p), 4)
  assert.equal(custo(t, p, true), 8)
})

test('resumo: custo calculado à mão, % do orçamento e modelo sem preço', () => {
  process.env.TZ = 'America/Sao_Paulo'
  const { logs, db } = ambiente()
  ingerir(db, logs)
  const cfg = { ...configPadrao, orcamentos: { ...configPadrao.orcamentos, dia: 0.1 } }
  const r = resumo(db, cfg, Date.parse('2026-10-31T20:00:00Z'))
  // opus: 1000*4 + 500*20 + 2000*8 + 10000*0.2 = 32000; haiku: 2000*0.1 + 1000*0.5 + 400*0.125 = 750
  assert.ok(Math.abs(r.dia.custoUsd - 0.03275) < 1e-9)
  assert.ok(Math.abs((r.dia.pct ?? 0) - 32.75) < 1e-6)
  assert.equal(r.dia.mensagens, 3)
  assert.deepEqual(r.dia.semPreco, ['modelo-inexistente'])
  assert.equal(r.semana.pct, null) // sem orçamento
  assert.equal(r.janela5h.mensagens, 3)
  const h = historico(db, cfg, 0, Date.parse('2026-11-01T00:00:00Z'), 'modelo')
  assert.equal(h[0].chave, 'claude-opus-5-5')
})

test('config: valida a entrada e mescla orçamentos', () => {
  const dados = tmp()
  assert.throws(() => validarConfig({ moeda: 'EUR' }))
  assert.throws(() => validarConfig({ orcamentos: { dia: -1 } }))
  assert.throws(() => validarConfig({ limiar: 150 }))
  assert.throws(() => validarConfig({ orcamentos: { dia: 0 } }))
  assert.throws(() =>
    validarConfig({
      precos: {
        x: { input: 1, output: 1, cacheWrite5m: 1, cacheWrite1h: 1, cacheRead: 1, multiplicadorRapido: 'a' },
      },
    }),
  )
  assert.throws(() => validarConfig({ precos: { x: { input: 'a' } } }))
  salvarConfig({ orcamentos: { dia: 10 } }, dados)
  const c = salvarConfig({ moeda: 'USD', orcamentos: { mes: 200 } }, dados)
  assert.deepEqual(c.orcamentos, { janela5h: null, dia: 10, semana: null, mes: 200 })
  assert.equal(lerConfig(dados).moeda, 'USD')
})

test('conta: só os campos da tela, sem ids da organização', () => {
  const c = interpretarStatus(
    JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      email: 'voce@exemplo.com',
      orgId: 'org-x',
      subscriptionType: 'pro',
      projectsDirectory: '~/.claude/projects',
    }),
  )
  assert.deepEqual(c, {
    conectada: true,
    email: 'voce@exemplo.com',
    plano: 'pro',
    metodo: 'claude.ai',
    pastaLogs: '~/.claude/projects',
  })
  assert.equal(interpretarStatus('{"loggedIn":false}').conectada, false)
})

test('câmbio: busca uma vez por dia e usa a última quando offline', async () => {
  const dados = tmp()
  let chamadas = 0
  const ok = (async () => {
    chamadas++
    return new Response(
      JSON.stringify({ value: [{ cotacaoVenda: 5.4212, dataHoraCotacao: '2026-10-30 13:04:18' }] }),
    )
  }) as typeof fetch
  const falha = (async () => {
    throw new Error('offline')
  }) as typeof fetch
  const hoje = Date.parse('2026-10-31T15:00:00Z')
  assert.equal(await obterCotacao(tmp(), hoje, falha), null)
  assert.equal((await obterCotacao(dados, hoje, ok))?.cotacao, 5.4212)
  await obterCotacao(dados, hoje + 3600_000, ok)
  assert.equal(chamadas, 1)
  const amanha = await obterCotacao(dados, hoje + 86400_000, falha)
  assert.equal(amanha?.antiga, true)
  assert.equal(amanha?.cotacao, 5.4212)
  await obterCotacao(dados, hoje + 86400_000 + 60_000, ok) // offline há 1 min: nem tenta
  assert.equal(chamadas, 1)
})
