import fs from 'node:fs'
import path from 'node:path'
import { chaveDia, PERIODOS, type Periodo } from './periods.ts'
import type { ResumoPeriodo } from './summary.ts'

export type Alerta = { id: string; periodo: Periodo; nivel: 80 | 100; pct: number; texto: string }

const NOME: Record<Periodo, string> = {
  janela5h: 'da janela de 5h',
  dia: 'de hoje',
  semana: 'da semana',
  mes: 'do mês',
}

// Um id por período + limiar: o mesmo aviso não se repete dentro do período.
export function alertasAtivos(
  periodos: Record<Periodo, ResumoPeriodo>,
  limiar: number,
  agora = Date.now(),
): Alerta[] {
  const lista: Alerta[] = []
  for (const p of PERIODOS) {
    const r = periodos[p]
    if (r.pct === null || r.pct < limiar) continue
    const nivel = r.pct >= 100 ? 100 : 80
    const chave = p === 'janela5h' ? chaveDia(agora) : chaveDia(r.inicio)
    const pctTxt = Math.round(r.pct)
    lista.push({
      id: `${p}:${chave}:${nivel}`,
      periodo: p,
      nivel,
      pct: r.pct,
      texto:
        nivel === 100
          ? `Limite do orçamento ${NOME[p]} atingido: ${pctTxt}%`
          : `Restam ${100 - pctTxt}% do orçamento ${NOME[p]} (${pctTxt}% usado)`,
    })
  }
  return lista
}

// Grava um JSON trocando o arquivo de uma vez: quem lê ao mesmo tempo nunca vê metade.
export function gravarJson(arquivo: string, dados: unknown) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  const tmp = `${arquivo}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(dados))
  try {
    fs.renameSync(tmp, arquivo)
  } catch {
    fs.rmSync(tmp, { force: true }) // EPERM no Windows com o arquivo aberto: fica para a próxima rodada
  }
}

// Ids já mostrados por um canal (Windows, hook), podando os de mais de 40 dias.
export function filtrarNovos(arquivo: string, alertas: Alerta[], agora = Date.now()): Alerta[] {
  let vistos: Record<string, number> = {}
  try {
    vistos = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    // primeiro uso
  }
  const novos = alertas.filter((a) => !(a.id in vistos))
  if (novos.length) {
    for (const a of novos) vistos[a.id] = agora
    for (const [id, em] of Object.entries(vistos)) if (agora - em > 40 * 86400_000) delete vistos[id]
    gravarJson(arquivo, vistos)
  }
  return novos
}
