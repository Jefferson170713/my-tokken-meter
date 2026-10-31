import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { parseLinha } from './parser.ts'
import { pastaLogs } from './paths.ts'

export type ResultadoLeitura = { arquivos: number; lidos: number; novas: number; ignoradas: number }

// Lê só o que cresceu desde a última vez; arquivos apagados pelo Claude Code ficam no banco.
export function ingerir(db: DatabaseSync, dir = pastaLogs()): ResultadoLeitura {
  const arquivos = (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.jsonl') && !f.split(/[\\/]/).includes('tool-results'))
    .map((f) => path.join(dir, f))

  const offsetDe = db.prepare('SELECT offset, ignoradas FROM files WHERE path = ?')
  const salvarOffset = db.prepare(
    'INSERT INTO files (path, offset, ignoradas) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET offset = excluded.offset, ignoradas = excluded.ignoradas',
  )
  // max em cada coluna: a mesma mensagem é gravada várias vezes no streaming
  const inserir = db.prepare(`
    INSERT INTO messages (msg_id, req_id, ts, session_id, project, model, input, output, cw5m, cw1h, cread, sidechain, speed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(msg_id, req_id) DO UPDATE SET
      input = max(input, excluded.input), output = max(output, excluded.output),
      cw5m = max(cw5m, excluded.cw5m), cw1h = max(cw1h, excluded.cw1h), cread = max(cread, excluded.cread)
  `)
  const contar = db.prepare('SELECT count(*) AS c FROM messages')

  const antes = Number((contar.get() as { c: number }).c)
  let lidos = 0
  let ignoradas = 0
  for (const arquivo of arquivos) {
    let tamanho: number
    try {
      tamanho = fs.statSync(arquivo).size
    } catch {
      continue // apagado pelo Claude Code entre a listagem e a leitura
    }
    const salvo = offsetDe.get(arquivo) as { offset: number; ignoradas: number } | undefined
    const offset = salvo?.offset ?? 0
    if (tamanho === offset) continue
    const inicio = tamanho < offset ? 0 : offset // arquivo reescrito: relê do zero (o dedupe protege)
    const buf = Buffer.alloc(tamanho - inicio)
    const fd = fs.openSync(arquivo, 'r')
    try {
      fs.readSync(fd, buf, 0, buf.length, inicio)
    } finally {
      fs.closeSync(fd)
    }
    const fim = buf.lastIndexOf(0x0a)
    if (fim < 0) continue // nenhuma linha completa ainda
    let ignArquivo = 0
    db.exec('BEGIN')
    try {
      for (const linha of buf.subarray(0, fim).toString('utf8').split('\n')) {
        if (!linha.trim()) continue
        const r = parseLinha(linha)
        if (r === 'ignorar') continue
        if (r === 'invalida') {
          ignArquivo++
          continue
        }
        inserir.run(
          r.msgId,
          r.reqId,
          r.ts,
          r.sessionId,
          r.project,
          r.model,
          r.input,
          r.output,
          r.cw5m,
          r.cw1h,
          r.cread,
          r.sidechain ? 1 : 0,
          r.speed,
        )
      }
      // releitura do zero substitui a contagem antiga em vez de somar
      salvarOffset.run(arquivo, inicio + fim + 1, ignArquivo + (inicio === 0 ? 0 : (salvo?.ignoradas ?? 0)))
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    lidos++
    ignoradas += ignArquivo
  }
  const depois = Number((contar.get() as { c: number }).c)
  return { arquivos: arquivos.length, lidos, novas: depois - antes, ignoradas }
}

export function totalIgnoradas(db: DatabaseSync): number {
  return Number((db.prepare('SELECT coalesce(sum(ignoradas), 0) AS s FROM files').get() as { s: number }).s)
}
