import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { criarServidor } from '../server/main.ts'

let base = ''
let dados = ''
let app: ReturnType<typeof criarServidor>

before(async () => {
  dados = fs.mkdtempSync(path.join(os.tmpdir(), 'mtm-api-'))
  // cotação já salva hoje: o teste não chama a rede
  fs.writeFileSync(
    path.join(dados, 'cambio.json'),
    JSON.stringify({ cotacao: 5.42, dataHora: 'x', buscadoEm: Date.now() }),
  )
  app = criarServidor({ porta: 0, dados, logs: path.join(import.meta.dirname, 'fixtures', 'projects') })
  await new Promise<void>((ok) => app.servidor.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${app.porta()}`
})
after(() => {
  app.servidor.close()
  app.db.close()
  fs.rmSync(dados, { recursive: true, force: true })
})

test('api: health e rota inexistente', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true })
  assert.equal((await fetch(`${base}/api/nada`)).status, 404)
})

test('api: resumo lê as fixtures e traz a cotação salva', async () => {
  const r = await (await fetch(`${base}/api/resumo`)).json()
  assert.equal(r.cotacao.cotacao, 5.42)
  assert.equal(r.linhasIgnoradas, 1)
  assert.ok('dia' in r.periodos && 'janela5h' in r.periodos)
})

test('api: historico valida o agrupamento', async () => {
  assert.equal((await fetch(`${base}/api/historico?agrupar=xyz`)).status, 400)
  const h = await (
    await fetch(`${base}/api/historico?agrupar=modelo&de=0&ate=${Date.parse('2026-11-01')}`)
  ).json()
  assert.equal(h[0].chave, 'claude-opus-5-5')
})

test('api: config grava o válido e recusa o inválido', async () => {
  const put = (corpo: string) => fetch(`${base}/api/config`, { method: 'PUT', body: corpo })
  assert.equal((await put('{"moeda":"EUR"}')).status, 400)
  assert.equal((await put('nao json')).status, 400)
  assert.equal((await (await put('{"orcamentos":{"dia":10}}')).json()).orcamentos.dia, 10)
  assert.equal((await (await fetch(`${base}/api/config`)).json()).orcamentos.dia, 10)
})

test('api: corpo grande, data vazia e origem de outro site', async () => {
  const grande = await fetch(`${base}/api/config`, { method: 'PUT', body: 'x'.repeat(70_000) })
  assert.equal(grande.status, 413)
  assert.equal((await fetch(`${base}/api/historico?ate=`)).status, 400)
  const outro = await fetch(`${base}/api/resumo`, { headers: { origin: 'https://evil.example' } })
  assert.equal(outro.status, 403)
  const acento = await fetch(`${base}/api/config`, { method: 'PUT', body: '{"moeda":"EUR ç"}' })
  assert.match((await acento.json()).erro, /moeda/)
})

test('api: Host diferente é recusado (DNS rebinding)', async () => {
  const status = await new Promise<number>((ok) => {
    http.get(
      { host: '127.0.0.1', port: app.porta(), path: '/api/health', headers: { host: 'evil.example' } },
      (r) => {
        r.resume()
        ok(r.statusCode ?? 0)
      },
    )
  })
  assert.equal(status, 403)
})
