import type { Config, Cotacao } from './api.ts'

export type Exibicao = { moeda: Config['moeda']; cotacao: Cotacao | null }

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// Sem cotação, o app mostra em dólar (e avisa) mesmo com R$ escolhido.
export const emReais = (e: Exibicao) => e.moeda === 'BRL' && e.cotacao !== null

export function dinheiro(valorUsd: number, e: Exibicao): string {
  return emReais(e) ? brl.format(valorUsd * e.cotacao!.cotacao) : usd.format(valorUsd)
}

export function tokens(n: number): string {
  if (n >= 1e6) return `${decimal.format(n / 1e6)} mi`
  if (n >= 1e3) return `${Math.round(n / 1e3)} mil`
  return String(n)
}

export const inteiro = (n: number) => n.toLocaleString('pt-BR')

export function haQuanto(ts: number, agora = Date.now()): string {
  const s = Math.max(0, Math.round((agora - ts) / 1000))
  if (s < 60) return `há ${s} s`
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  return `há ${Math.round(s / 3600)} h`
}

export function dataLonga(ts: number): string {
  const t = new Date(ts).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function dataCurta(chaveDia: string): string {
  const [a, m, d] = chaveDia.split('-').map(Number)
  return new Date(a, m - 1, d)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}
