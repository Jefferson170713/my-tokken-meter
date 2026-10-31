import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { acharClaude } from '../core/conta.ts'

export const RAIZ = path.join(import.meta.dirname, '..').replaceAll('\\', '/')
export const SETTINGS = path.join(
  process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'),
  'settings.json',
)
const node = process.execPath.replaceAll('\\', '/')
export const CMD_HOOK = `"${node}" "${RAIZ}/integrations/hook.mjs"`
export const CMD_STATUS = `"${node}" "${RAIZ}/integrations/statusline.mjs"`
export const CMD_MCP = [node, `${RAIZ}/mcp/main.ts`]
// marca das entradas deste app: só elas são removidas pelo desintegrar
export const eDoApp = (comando: unknown) =>
  typeof comando === 'string' && comando.includes(`${RAIZ}/integrations/`)

export type Settings = Record<string, unknown> & {
  hooks?: Record<string, { matcher?: string; hooks: { type: string; command: string; timeout?: number }[] }[]>
  statusLine?: { type: string; command: string }
}

export function lerSettings(): Settings {
  if (!fs.existsSync(SETTINGS)) return {}
  return JSON.parse(fs.readFileSync(SETTINGS, 'utf8').replace(/^\uFEFF/, ''))
}

export function gravarSettings(s: Settings) {
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-mtm-${Date.now()}`)
  fs.writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`)
}

export async function confirmar(pergunta: string): Promise<boolean> {
  if (process.argv.includes('--sim')) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const r = await rl.question(`${pergunta} (s/n) `)
  rl.close()
  return /^s/i.test(r.trim())
}

export function claude(args: string[]): Promise<string> {
  const bin = acharClaude()
  return new Promise((ok) =>
    execFile(
      bin,
      args,
      { timeout: 30_000, shell: process.platform === 'win32' && !bin.toLowerCase().endsWith('.exe') },
      (erro, out, err) => ok(erro ? `falhou: ${(err || erro.message).trim()}` : out.trim()),
    ),
  )
}
