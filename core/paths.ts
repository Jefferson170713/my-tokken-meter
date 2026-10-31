import os from 'node:os'
import path from 'node:path'

// Pasta dos logs do Claude Code (respeita CLAUDE_CONFIG_DIR); MTM_CLAUDE_PROJECTS aponta para fixtures nos testes.
export function pastaLogs(): string {
  if (process.env.MTM_CLAUDE_PROJECTS) return process.env.MTM_CLAUDE_PROJECTS
  const base = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')
  return path.join(base, 'projects')
}

// Pasta data/ do app, relativa ao código para o MCP achá-la de qualquer cwd.
export function pastaDados(): string {
  return process.env.MTM_DATA_DIR ?? path.join(import.meta.dirname, '..', 'data')
}
