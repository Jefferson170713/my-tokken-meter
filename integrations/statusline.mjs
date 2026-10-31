// Statusline do Claude Code: uma linha com o consumo e o badge do ponytail. De quebra, guarda a % real do
// plano (rate_limits) em data/plano.json, sem usar o token. Nunca falha: no pior caso imprime só o badge.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extrairPlano } from '../core/plan.ts'

const dados = process.env.MTM_DATA_DIR ?? path.join(import.meta.dirname, '..', 'data')
const ler = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

let entrada = null
try {
  entrada = JSON.parse(fs.readFileSync(0, 'utf8'))
} catch {
  // sem stdin
}

const plano = extrairPlano(entrada)
const arquivoPlano = path.join(dados, 'plano.json')
const antigo = ler(arquivoPlano)
if (
  plano &&
  (!antigo ||
    antigo.cincoH !== plano.cincoH ||
    antigo.semana !== plano.semana ||
    plano.em - antigo.em > 60_000)
) {
  try {
    fs.mkdirSync(dados, { recursive: true })
    fs.writeFileSync(arquivoPlano, JSON.stringify(plano))
  } catch {
    // pasta bloqueada: segue sem gravar
  }
}

const partes = []
const ponytail = path.join(os.homedir(), '.claude', '.ponytail-active')
if (fs.existsSync(ponytail))
  partes.push(/ultra/i.test(fs.readFileSync(ponytail, 'utf8')) ? '[PONYTAIL:ULTRA]' : '[PONYTAIL]')

const status = ler(path.join(dados, 'status.json'))
let cor = ''
if (status && Date.now() - status.geradoEm < 10 * 60_000) {
  const pct = (p) => (status.pct?.[p] == null ? null : `${Math.round(status.pct[p])}%`)
  if (pct('dia')) partes.push(`dia ${pct('dia')}`)
  if (pct('semana')) partes.push(`sem ${pct('semana')}`)
  const renova = plano?.renova5h ?? status.renova5h
  if (renova && renova > Date.now()) partes.push(`5h renova ${hora(renova)}`)
  const nivel = Math.max(0, ...(status.alertas ?? []).map((a) => a.nivel))
  cor = nivel === 100 ? '\x1b[31m' : nivel === 80 ? '\x1b[33m' : ''
}
if (plano?.cincoH != null) partes.push(`plano 5h ${Math.round(plano.cincoH)}%`)

process.stdout.write(cor ? `${cor}${partes.join(' · ')}\x1b[0m` : partes.join(' · '))
