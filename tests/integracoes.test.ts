import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { alertasAtivos, filtrarNovos } from '../core/alerts.ts'
import { configPadrao } from '../core/config.ts'
import { abrirDb } from '../core/db.ts'
import { extrairPlano } from '../core/plan.ts'
import { sessaoAtual } from '../core/sessao.ts'
import type { ResumoPeriodo } from '../core/summary.ts'

const RAIZ = path.join(import.meta.dirname, '..')
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mtm-int-'))
const T = (iso: string) => Date.parse(iso)

function dbCom(...horarios: string[]) {
  const db = abrirDb(tmp())
  const ins = db.prepare(
    "INSERT INTO messages VALUES (?, '', ?, 's', 'p', 'claude-opus-5-5', 1000000, 0, 0, 0, 0, 0, NULL)",
  )
  horarios.forEach((h, i) => ins.run(`m${i}`, T(h)))
  return db
}

test('sessão: abre na hora cheia, dura 5h e a próxima abre depois', () => {
  const db = dbCom('2026-10-31T10:20:00Z', '2026-10-31T11:00:00Z')
  const s = sessaoAtual(db, configPadrao, T('2026-10-31T12:00:00Z'))!
  assert.equal(s.inicio, T('2026-10-31T10:00:00Z'))
  assert.equal(s.fim, T('2026-10-31T15:00:00Z'))
  assert.equal(s.mensagens, 2)
  assert.equal(s.custoUsd, 8) // 2 x 1 mi de entrada a US$ 4
  assert.equal(s.serie.length, 20)
  assert.equal(sessaoAtual(db, configPadrao, T('2026-10-31T16:00:00Z')), null)
  const nova = dbCom('2026-10-31T10:20:00Z', '2026-10-31T15:30:00Z')
  assert.equal(sessaoAtual(nova, configPadrao, T('2026-10-31T16:00:00Z'))!.inicio, T('2026-10-31T15:00:00Z'))
})

test('alertas: 80% e 100%, cada um uma vez por canal', () => {
  const p = (pct: number | null) => ({ pct, inicio: T('2026-10-31T03:00:00Z') }) as ResumoPeriodo
  const periodos = { janela5h: p(null), dia: p(85), semana: p(120), mes: p(10) }
  const a = alertasAtivos(periodos, 80, T('2026-10-31T15:00:00Z'))
  assert.deepEqual(
    a.map((x) => [x.periodo, x.nivel]),
    [
      ['dia', 80],
      ['semana', 100],
    ],
  )
  const arq = path.join(tmp(), 'vistos.json')
  assert.equal(filtrarNovos(arq, a).length, 2)
  assert.equal(filtrarNovos(arq, a).length, 0)
})

test('plano: lê rate_limits em segundos ou ISO', () => {
  const p = extrairPlano({
    rate_limits: {
      five_hour: { used_percentage: 37, resets_at: 1793479200 },
      seven_day: { used_percentage: 61, resets_at: '2026-11-06T12:00:00Z' },
    },
  })!
  assert.equal(p.cincoH, 37)
  assert.equal(p.renova5h, 1793479200_000)
  assert.equal(p.renovaSemana, T('2026-11-06T12:00:00Z'))
  assert.equal(extrairPlano({}), null)
})

test('hook: avisa uma vez, rápido, e fica calado sem status', () => {
  const dados = tmp()
  const rodar = () =>
    execFileSync(process.execPath, [path.join(RAIZ, 'integrations', 'hook.mjs')], {
      env: { ...process.env, MTM_DATA_DIR: dados },
      encoding: 'utf8',
    })
  assert.equal(rodar(), '')
  fs.writeFileSync(
    path.join(dados, 'status.json'),
    JSON.stringify({ geradoEm: Date.now(), alertas: [{ id: 'dia:x:80', nivel: 80, texto: 'Restam 20%' }] }),
  )
  const inicio = Date.now()
  const saida = JSON.parse(rodar())
  assert.ok(Date.now() - inicio < 2000)
  assert.match(saida.systemMessage, /Restam 20%/)
  assert.equal(saida.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
  assert.equal(rodar(), '')
})

test('statusline: guarda a % do plano e mostra a renovação', () => {
  const dados = tmp()
  fs.writeFileSync(
    path.join(dados, 'status.json'),
    JSON.stringify({ geradoEm: Date.now(), pct: { dia: 42 }, alertas: [] }),
  )
  const renova = Math.floor((Date.now() + 3600_000) / 1000)
  const saida = execFileSync(process.execPath, [path.join(RAIZ, 'integrations', 'statusline.mjs')], {
    env: { ...process.env, MTM_DATA_DIR: dados },
    input: JSON.stringify({ rate_limits: { five_hour: { used_percentage: 37, resets_at: renova } } }),
    encoding: 'utf8',
  })
  assert.match(saida, /dia 42%/)
  assert.match(saida, /5h renova/)
  assert.match(saida, /plano 5h 37%/)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'plano.json'), 'utf8')).cincoH, 37)
})

test('mcp: responde consumo_atual pelo protocolo stdio', async () => {
  const filho = spawn(process.execPath, [path.join(RAIZ, 'mcp', 'main.ts')], {
    env: {
      ...process.env,
      MTM_DATA_DIR: tmp(),
      MTM_CLAUDE_PROJECTS: path.join(RAIZ, 'tests', 'fixtures', 'projects'),
    },
  })
  let buffer = ''
  const respostas = new Map<number, unknown>()
  filho.stdout.on('data', (d) => {
    buffer += d
    let i
    while ((i = buffer.indexOf('\n')) >= 0) {
      const msg = JSON.parse(buffer.slice(0, i))
      buffer = buffer.slice(i + 1)
      if ('id' in msg) respostas.set(msg.id, msg)
    }
  })
  const enviar = (m: object) => filho.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...m })}\n`)
  const esperar = async (id: number) => {
    for (let t = 0; t < 100 && !respostas.has(id); t++) await new Promise((r) => setTimeout(r, 100))
    return respostas.get(id) as { result: { tools?: { name: string }[]; content?: { text: string }[] } }
  }
  enviar({
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
  })
  await esperar(1)
  enviar({ method: 'notifications/initialized' })
  enviar({ id: 2, method: 'tools/list' })
  const lista = await esperar(2)
  assert.deepEqual(lista.result.tools!.map((t) => t.name).sort(), [
    'consumo_atual',
    'consumo_periodo',
    'status_orcamento',
  ])
  enviar({ id: 3, method: 'tools/call', params: { name: 'consumo_atual', arguments: {} } })
  const r = await esperar(3)
  filho.kill()
  assert.match(r.result.content![0].text, /Hoje: US\$/)
})
