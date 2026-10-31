import fs from 'node:fs'
import path from 'node:path'
import { PERIODOS, type Periodo } from './periods.ts'
import type { Preco, TabelaPrecos } from './prices.ts'
import { pastaDados } from './paths.ts'

export type Moeda = 'BRL' | 'USD'
export type Config = {
  moeda: Moeda
  unidade: 'usd' | 'tokens' // orçamentos guardados em US$ (a moeda é só exibição) ou em tokens
  orcamentos: Record<Periodo, number | null>
  limiar: number
  precos: TabelaPrecos // sobrescreve a tabela padrão
  planoAtivo: boolean
}

export const configPadrao: Config = {
  moeda: 'BRL',
  unidade: 'usd',
  orcamentos: { janela5h: null, dia: null, semana: null, mes: null },
  limiar: 80,
  precos: {},
  planoAtivo: true,
}

const arquivo = (dir: string) => path.join(dir, 'config.json')

export function lerConfig(dir = pastaDados()): Config {
  try {
    const salvo = validarConfig(JSON.parse(fs.readFileSync(arquivo(dir), 'utf8')))
    const base = structuredClone(configPadrao)
    return { ...base, ...salvo, orcamentos: { ...base.orcamentos, ...salvo.orcamentos } }
  } catch {
    return structuredClone(configPadrao)
  }
}

const numeroOk = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0

// Fronteira de confiança: o PUT /api/config chega aqui.
export function validarConfig(entrada: unknown): Partial<Config> {
  if (!entrada || typeof entrada !== 'object') throw new Error('configuração inválida')
  const e = entrada as Record<string, unknown>
  const saida: Partial<Config> = {}
  if ('moeda' in e) {
    if (e.moeda !== 'BRL' && e.moeda !== 'USD') throw new Error('moeda deve ser BRL ou USD')
    saida.moeda = e.moeda
  }
  if ('unidade' in e) {
    if (e.unidade !== 'usd' && e.unidade !== 'tokens') throw new Error('unidade deve ser usd ou tokens')
    saida.unidade = e.unidade
  }
  if ('limiar' in e) {
    if (typeof e.limiar !== 'number' || e.limiar < 1 || e.limiar > 99)
      throw new Error('limiar deve ser de 1 a 99')
    saida.limiar = e.limiar
  }
  if ('planoAtivo' in e) {
    if (typeof e.planoAtivo !== 'boolean') throw new Error('planoAtivo deve ser true ou false')
    saida.planoAtivo = e.planoAtivo
  }
  if ('orcamentos' in e) {
    const o = e.orcamentos as Record<string, unknown>
    if (!o || typeof o !== 'object') throw new Error('orcamentos inválidos')
    const orc: Partial<Record<Periodo, number | null>> = {}
    for (const [k, v] of Object.entries(o)) {
      if (!PERIODOS.includes(k as Periodo)) throw new Error(`período desconhecido: ${k}`)
      if (v !== null && (!numeroOk(v) || v === 0))
        throw new Error(`orçamento inválido em ${k} (use null para nenhum)`)
      orc[k as Periodo] = v as number | null
    }
    saida.orcamentos = orc as Record<Periodo, number | null>
  }
  if ('precos' in e) {
    const p = e.precos as Record<string, Record<string, unknown>>
    if (!p || typeof p !== 'object') throw new Error('precos inválidos')
    const tabela: TabelaPrecos = {}
    for (const [modelo, preco] of Object.entries(p)) {
      const limpo = {} as Preco
      for (const campo of ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead'] as const) {
        if (!numeroOk(preco?.[campo])) throw new Error(`preço inválido: ${modelo}.${campo}`)
        limpo[campo] = preco[campo] as number
      }
      if (preco.multiplicadorRapido !== undefined) {
        if (!numeroOk(preco.multiplicadorRapido))
          throw new Error(`preço inválido: ${modelo}.multiplicadorRapido`)
        limpo.multiplicadorRapido = preco.multiplicadorRapido as number
      }
      tabela[modelo] = limpo // só campos conhecidos são gravados
    }
    saida.precos = tabela
  }
  return saida
}

export function salvarConfig(parcial: unknown, dir = pastaDados()): Config {
  const v = validarConfig(parcial)
  const atual = lerConfig(dir)
  const nova: Config = { ...atual, ...v, orcamentos: { ...atual.orcamentos, ...v.orcamentos } }
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${arquivo(dir)}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(nova, null, 2))
  fs.renameSync(tmp, arquivo(dir))
  return nova
}
