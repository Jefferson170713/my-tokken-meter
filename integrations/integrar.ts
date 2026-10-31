// Instala no Claude Code: servidor MCP, hook de aviso e statusline. Mostra o que muda, pede ok e faz backup.
import {
  claude,
  CMD_HOOK,
  CMD_MCP,
  CMD_STATUS,
  confirmar,
  eDoApp,
  gravarSettings,
  lerSettings,
  SETTINGS,
} from './comum.ts'

const s = lerSettings()
const ups = s.hooks?.UserPromptSubmit ?? []
const temHook = ups.some((g) => g.hooks.some((h) => eDoApp(h.command)))
const outraStatus = s.statusLine && !eDoApp(s.statusLine.command)

console.log(`Vai mudar em ${SETTINGS} (com backup antes):`)
console.log(
  temHook
    ? '  - aviso na conversa (hook): já instalado'
    : '  - adicionar o aviso na conversa (hook UserPromptSubmit)',
)
console.log(
  outraStatus
    ? `  - statusline: você já usa outra (${s.statusLine!.command}); não vou substituir`
    : s.statusLine
      ? '  - statusline: já instalada'
      : '  - adicionar a statusline do app (consumo + badge do ponytail + % real do plano)',
)
console.log('E registrar o servidor MCP "my-tokken-meter" (escopo de usuário) com `claude mcp add`.')

if (!(await confirmar('Aplicar?'))) {
  console.log('Nada foi alterado.')
  process.exit(0)
}
const semStatus = !s.statusLine
if (!temHook) {
  s.hooks = {
    ...s.hooks,
    UserPromptSubmit: [...ups, { hooks: [{ type: 'command', command: CMD_HOOK, timeout: 2 }] }],
  }
}
if (semStatus) s.statusLine = { type: 'command', command: CMD_STATUS }
if (!temHook || semStatus) gravarSettings(s)
const mcp = await claude(['mcp', 'add', '--scope', 'user', 'my-tokken-meter', '--', ...CMD_MCP])
console.log(/already exists/i.test(mcp) ? '  - servidor MCP: já registrado' : mcp)
console.log(
  'Pronto. Abra uma conversa nova no Claude Code para carregar o MCP. Para desfazer: npm run desintegrar.',
)
