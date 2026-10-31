export type Registro = {
  msgId: string
  reqId: string
  ts: number
  sessionId: string | null
  project: string | null
  model: string
  input: number
  output: number
  cw5m: number
  cw1h: number
  cread: number
  sidechain: boolean
  speed: string | null
}

type Uso = {
  input_tokens?: unknown
  output_tokens?: unknown
  cache_creation_input_tokens?: unknown
  cache_creation?: { ephemeral_5m_input_tokens?: unknown; ephemeral_1h_input_tokens?: unknown }
  cache_read_input_tokens?: unknown
  speed?: unknown
}
type LinhaLog = {
  type?: unknown
  timestamp?: unknown
  requestId?: unknown
  sessionId?: unknown
  cwd?: unknown
  isSidechain?: unknown
  message?: { id?: unknown; model?: unknown; usage?: Uso }
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

// Só linhas `assistant` com usage contam; o resto (prompts, api-request*, cost-state...) nunca é copiado.
export function parseLinha(texto: string): Registro | 'ignorar' | 'invalida' {
  let o: LinhaLog
  try {
    o = JSON.parse(texto)
  } catch {
    return 'invalida'
  }
  if (o?.type !== 'assistant') return 'ignorar'
  const m = o.message
  if (m?.model === '<synthetic>') return 'ignorar'
  const u = m?.usage
  const ts = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN
  if (!m || !u || typeof m.id !== 'string' || typeof m.model !== 'string' || Number.isNaN(ts))
    return 'invalida'

  const total = n(u.cache_creation_input_tokens)
  let cw5m = n(u.cache_creation?.ephemeral_5m_input_tokens)
  const cw1h = n(u.cache_creation?.ephemeral_1h_input_tokens)
  // sem o detalhamento (ou somando menos), a diferença conta como cache de 5 min
  if (cw5m + cw1h < total) cw5m += total - (cw5m + cw1h)

  return {
    msgId: m.id,
    reqId: typeof o.requestId === 'string' ? o.requestId : '',
    ts,
    sessionId: typeof o.sessionId === 'string' ? o.sessionId : null,
    project: typeof o.cwd === 'string' ? o.cwd : null,
    model: m.model,
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cw5m,
    cw1h,
    cread: n(u.cache_read_input_tokens),
    sidechain: o.isSidechain === true,
    speed: typeof u.speed === 'string' ? u.speed : null,
  }
}
