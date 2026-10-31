import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type Conta = {
  conectada: boolean
  email: string | null
  plano: string | null
  metodo: string | null
  pastaLogs: string | null
}

// Só os campos que a tela usa; o resto da saída (ids da organização etc.) é descartado.
export function interpretarStatus(saida: string): Conta {
  const s = JSON.parse(saida)
  const txt = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    conectada: s.loggedIn === true,
    email: txt(s.email),
    plano: txt(s.subscriptionType),
    metodo: txt(s.authMethod),
    pastaLogs: txt(s.projectsDirectory),
  }
}

// O CLI nem sempre está no PATH: a extensão do VS Code traz o binário nativo.
export function acharClaude(): string {
  if (process.env.MTM_CLAUDE_BIN) return process.env.MTM_CLAUDE_BIN
  const ext = path.join(os.homedir(), '.vscode', 'extensions')
  try {
    const dirs = fs
      .readdirSync(ext)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })) // 2.0.10 depois de 2.0.9
    for (const d of dirs) {
      const bin = path.join(
        ext,
        d,
        'resources',
        'native-binary',
        process.platform === 'win32' ? 'claude.exe' : 'claude',
      )
      if (fs.existsSync(bin)) return bin
    }
  } catch {
    // sem extensão do VS Code
  }
  return 'claude'
}

// Lê a conta com `claude auth status`, sem tocar no token.
export function lerConta(): Promise<Conta> {
  const bin = acharClaude()
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      ['auth', 'status'],
      { timeout: 10_000, shell: process.platform === 'win32' && !bin.toLowerCase().endsWith('.exe') },
      (erro, stdout) => {
        // sem login o comando pode sair com código != 0, mas ainda imprime o JSON
        try {
          resolve(interpretarStatus(stdout))
        } catch {
          reject(
            new Error(
              erro ? `claude auth status falhou: ${erro.message}` : 'saída inesperada do claude auth status',
            ),
          )
        }
      },
    )
  })
}
