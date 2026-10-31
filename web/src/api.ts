import type { Cotacao } from '../../core/cambio.ts'
import type { Config } from '../../core/config.ts'
import type { Conta } from '../../core/conta.ts'
import type { Periodo } from '../../core/periods.ts'
import type { TabelaPrecos } from '../../core/prices.ts'
import type { Agrupar, ResumoPeriodo, Totais } from '../../core/summary.ts'
import type { Plano } from '../../core/plan.ts'
import type { Sessao } from '../../core/sessao.ts'

export type { Config, Conta, Cotacao, Periodo, Plano, ResumoPeriodo, Sessao, TabelaPrecos, Totais }
export type Resumo = {
  periodos: Record<Periodo, ResumoPeriodo>
  moeda: Config['moeda']
  unidade: Config['unidade']
  limiar: number
  cotacao: Cotacao | null
  linhasIgnoradas: number
  ultimaLeitura: number
  tabelaPrecos: { atualizadoEm: string; fonte: string }
  sessao: Sessao | null
  plano: Plano | null
}
export type LinhaHistorico = Totais & { chave: string }
export type ContaApp = Conta & {
  entrou: boolean
  ultima: { email: string; plano: string | null; entrouEm: number } | null
}

export class ErroApi extends Error {
  status: number
  corpo: { erro?: string; pastaLogs?: string }
  constructor(status: number, corpo: { erro?: string; pastaLogs?: string }) {
    super(corpo.erro ?? `erro ${status}`)
    this.status = status
    this.corpo = corpo
  }
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(caminho, init)
  const corpo = await r.json()
  if (!r.ok) throw new ErroApi(r.status, corpo)
  return corpo as T
}

export const api = {
  resumo: () => pedir<Resumo>('/api/resumo'),
  historico: (agrupar: Agrupar, de: number, ate: number) =>
    pedir<LinhaHistorico[]>(`/api/historico?agrupar=${agrupar}&de=${de}&ate=${ate}`),
  config: () => pedir<Config>('/api/config'),
  salvarConfig: (parcial: Partial<Config>) =>
    pedir<Config>('/api/config', { method: 'PUT', body: JSON.stringify(parcial) }),
  conta: () => pedir<ContaApp>('/api/conta'),
  entrar: () => pedir<ContaApp>('/api/entrar', { method: 'POST' }),
  sair: () => pedir<{ ok: boolean }>('/api/sair', { method: 'POST' }),
  precos: () => pedir<{ padrao: TabelaPrecos; atualizadoEm: string; fonte: string }>('/api/precos'),
}
