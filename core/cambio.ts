import fs from 'node:fs'
import path from 'node:path'
import { chaveDia } from './periods.ts'
import { pastaDados } from './paths.ts'

export type Cotacao = { cotacao: number; dataHora: string; buscadoEm: number; antiga?: boolean }

const URL_PTAX =
  'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)'

const mdy = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
}

// Últimos 7 dias: fim de semana e feriado não têm PTAX, então pega a mais recente.
export function urlPtax(agora: number): string {
  const q = `@dataInicial='${mdy(agora - 7 * 86400_000)}'&@dataFinalCotacao='${mdy(agora)}'&$format=json&$orderby=dataHoraCotacao%20desc&$top=1`
  return `${URL_PTAX}?${q}`
}

const ultimaFalha = new Map<string, number>()

// A única chamada de rede do app: uma vez por dia; sem internet, devolve a última salva (antiga) ou null.
export async function obterCotacao(
  dir = pastaDados(),
  agora = Date.now(),
  buscar: typeof fetch = fetch,
): Promise<Cotacao | null> {
  const arquivo = path.join(dir, 'cambio.json')
  let salvo: Cotacao | null = null
  try {
    salvo = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    // ainda sem cotação salva
  }
  if (salvo && chaveDia(salvo.buscadoEm) === chaveDia(agora)) return salvo
  const antiga = salvo ? { ...salvo, antiga: true } : null
  // offline: não tenta a rede de novo por 10 min, para a API não ficar lenta a cada requisição
  if (agora - (ultimaFalha.get(dir) ?? -Infinity) < 10 * 60_000) return antiga
  try {
    const r = await buscar(urlPtax(agora), { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`PTAX respondeu ${r.status}`)
    const v = ((await r.json()) as { value?: { cotacaoVenda?: unknown; dataHoraCotacao?: unknown }[] })
      .value?.[0]
    if (typeof v?.cotacaoVenda !== 'number' || typeof v.dataHoraCotacao !== 'string')
      throw new Error('PTAX sem cotação')
    const nova: Cotacao = { cotacao: v.cotacaoVenda, dataHora: v.dataHoraCotacao, buscadoEm: agora }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(arquivo, JSON.stringify(nova))
    return nova
  } catch {
    ultimaFalha.set(dir, agora)
    return antiga
  }
}
