export type Periodo = 'janela5h' | 'dia' | 'semana' | 'mes'
export const PERIODOS: Periodo[] = ['janela5h', 'dia', 'semana', 'mes']

// Início de cada período em epoch ms, no fuso local. Semana começa na segunda.
export function limites(agora: number): Record<Periodo, number> {
  const d = new Date(agora)
  const [a, m, dd] = [d.getFullYear(), d.getMonth(), d.getDate()]
  return {
    janela5h: agora - 5 * 3600_000,
    dia: new Date(a, m, dd).getTime(),
    semana: new Date(a, m, dd - ((d.getDay() + 6) % 7)).getTime(),
    mes: new Date(a, m, 1).getTime(),
  }
}

export function chaveDia(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
