import fs from 'node:fs'
import path from 'node:path'
import { pastaDados } from './paths.ts'

// % real do plano, gravada pela statusline a partir do `rate_limits` que o Claude Code entrega a ela.
export type Plano = {
  cincoH: number | null
  semana: number | null
  renova5h: number | null
  renovaSemana: number | null
  em: number
}

// resets_at pode vir em segundos, milissegundos ou texto ISO
export function paraMs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && v.trim() !== '') return paraMs(n)
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }
  return null
}

const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function extrairPlano(entrada: unknown, agora = Date.now()): Plano | null {
  const r = (entrada as { rate_limits?: Record<string, Record<string, unknown>> })?.rate_limits
  if (!r) return null
  const p: Plano = {
    cincoH: pct(r.five_hour?.used_percentage),
    semana: pct(r.seven_day?.used_percentage),
    renova5h: paraMs(r.five_hour?.resets_at),
    renovaSemana: paraMs(r.seven_day?.resets_at),
    em: agora,
  }
  return p.cincoH === null && p.semana === null ? null : p
}

export function lerPlano(dir = pastaDados()): Plano | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'plano.json'), 'utf8'))
  } catch {
    return null
  }
}
