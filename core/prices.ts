import padrao from './prices.default.json' with { type: 'json' }

export type Preco = {
  input: number
  output: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
  multiplicadorRapido?: number
}
export type TabelaPrecos = Record<string, Preco>
export type Tokens = { input: number; output: number; cw5m: number; cw1h: number; cread: number }

export const tabelaPadrao: TabelaPrecos = padrao.modelos
export const tabelaInfo = { atualizadoEm: padrao.atualizadoEm, fonte: padrao.fonte }

// Nome exato, senão o maior prefixo (cobre sufixos de data como -20251001).
export function precoDe(modelo: string, tabela: TabelaPrecos): Preco | null {
  if (tabela[modelo]) return tabela[modelo]
  let melhor = ''
  for (const chave of Object.keys(tabela))
    if (modelo.startsWith(chave) && chave.length > melhor.length) melhor = chave
  return melhor ? tabela[melhor] : null
}

export function custo(t: Tokens, p: Preco, rapido = false): number {
  const base =
    t.input * p.input +
    t.output * p.output +
    t.cw5m * p.cacheWrite5m +
    t.cw1h * p.cacheWrite1h +
    t.cread * p.cacheRead
  return (base / 1e6) * (rapido ? (p.multiplicadorRapido ?? 1) : 1)
}
