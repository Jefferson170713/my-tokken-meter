import type { DatabaseSync } from 'node:sqlite'
import type { Config } from './config.ts'
import { custo, precoDe, tabelaPadrao, type Tokens } from './prices.ts'

const H5 = 5 * 3600_000
const FATIA = 15 * 60_000

export type Sessao = {
  inicio: number
  fim: number
  custoUsd: number
  tokens: number
  mensagens: number
  serie: { inicio: number; custoUsd: number }[] // fatias de 15 min, da abertura até a renovação
}

type Linha = Tokens & { ts: number; model: string; speed: string | null }

// Estimativa pelos logs, na regra do limite do plano: a janela abre na hora cheia da primeira
// mensagem e dura 5h; a próxima abre na primeira mensagem depois disso. Sem sessão aberta: null.
export function sessaoAtual(db: DatabaseSync, cfg: Config, agora = Date.now()): Sessao | null {
  const linhas = db
    .prepare(
      'SELECT ts, model, speed, input, output, cw5m, cw1h, cread FROM messages WHERE ts >= ? AND ts <= ? ORDER BY ts',
    )
    .all(agora - 24 * 3600_000, agora) as Linha[]
  let inicio = -Infinity
  for (const l of linhas) if (l.ts >= inicio + H5) inicio = Math.floor(l.ts / 3600_000) * 3600_000
  if (agora >= inicio + H5) return null

  const tabela = { ...tabelaPadrao, ...cfg.precos }
  const serie = Array.from({ length: H5 / FATIA }, (_, i) => ({ inicio: inicio + i * FATIA, custoUsd: 0 }))
  const s: Sessao = { inicio, fim: inicio + H5, custoUsd: 0, tokens: 0, mensagens: 0, serie }
  for (const l of linhas) {
    if (l.ts < inicio) continue
    const p = precoDe(l.model, tabela)
    const c = p ? custo(l, p, l.speed === 'fast') : 0
    s.custoUsd += c
    s.tokens += l.input + l.output + l.cw5m + l.cw1h + l.cread
    s.mensagens++
    serie[Math.min(serie.length - 1, Math.floor((l.ts - inicio) / FATIA))].custoUsd += c
  }
  return s
}
