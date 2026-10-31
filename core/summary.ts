import type { DatabaseSync } from 'node:sqlite'
import type { Config } from './config.ts'
import { chaveDia, limites, PERIODOS, type Periodo } from './periods.ts'
import { custo, precoDe, tabelaPadrao, type Tokens } from './prices.ts'

type Linha = Tokens & {
  ts: number
  model: string
  session_id: string | null
  project: string | null
  speed: string | null
}

export type Totais = {
  custoUsd: number
  tokens: Tokens & { total: number }
  mensagens: number
  semPreco: string[] // modelos sem preço: os tokens contam, o custo não
}
export type ResumoPeriodo = Totais & { inicio: number; orcamento: number | null; pct: number | null }
export type Agrupar = 'dia' | 'sessao' | 'projeto' | 'modelo'

function linhas(db: DatabaseSync, de: number, ate: number): Linha[] {
  return db
    .prepare(
      'SELECT ts, model, session_id, project, speed, input, output, cw5m, cw1h, cread FROM messages WHERE ts >= ? AND ts <= ?',
    )
    .all(de, ate) as Linha[]
}

function somar(ls: Linha[], cfg: Config): Totais {
  const tabela = { ...tabelaPadrao, ...cfg.precos }
  const t: Totais = {
    custoUsd: 0,
    tokens: { input: 0, output: 0, cw5m: 0, cw1h: 0, cread: 0, total: 0 },
    mensagens: ls.length,
    semPreco: [],
  }
  for (const l of ls) {
    for (const k of ['input', 'output', 'cw5m', 'cw1h', 'cread'] as const) t.tokens[k] += l[k]
    const p = precoDe(l.model, tabela)
    if (p) t.custoUsd += custo(l, p, l.speed === 'fast')
    else if (!t.semPreco.includes(l.model)) t.semPreco.push(l.model)
  }
  t.tokens.total = t.tokens.input + t.tokens.output + t.tokens.cw5m + t.tokens.cw1h + t.tokens.cread
  return t
}

export function resumo(db: DatabaseSync, cfg: Config, agora = Date.now()): Record<Periodo, ResumoPeriodo> {
  const lim = limites(agora)
  const todas = linhas(db, Math.min(...Object.values(lim)), agora)
  const saida = {} as Record<Periodo, ResumoPeriodo>
  for (const p of PERIODOS) {
    const t = somar(
      todas.filter((l) => l.ts >= lim[p]),
      cfg,
    )
    const orcamento = cfg.orcamentos[p]
    const usado = cfg.unidade === 'tokens' ? t.tokens.total : t.custoUsd
    saida[p] = { ...t, inicio: lim[p], orcamento, pct: orcamento ? (usado / orcamento) * 100 : null }
  }
  return saida
}

export function historico(
  db: DatabaseSync,
  cfg: Config,
  de: number,
  ate: number,
  agrupar: Agrupar,
): (Totais & { chave: string })[] {
  const chaveDe: Record<Agrupar, (l: Linha) => string> = {
    dia: (l) => chaveDia(l.ts),
    sessao: (l) => l.session_id ?? '(sem sessão)',
    projeto: (l) => l.project ?? '(sem projeto)',
    modelo: (l) => l.model,
  }
  const grupos = new Map<string, Linha[]>()
  for (const l of linhas(db, de, ate)) {
    const k = chaveDe[agrupar](l)
    const g = grupos.get(k)
    if (g) g.push(l)
    else grupos.set(k, [l])
  }
  const lista = [...grupos].map(([chave, ls]) => ({ chave, ...somar(ls, cfg) }))
  return agrupar === 'dia'
    ? lista.sort((a, b) => b.chave.localeCompare(a.chave))
    : lista.sort((a, b) => b.custoUsd - a.custoUsd)
}
