// Remove só o que o integrar instalou (entradas que apontam para integrations/ deste projeto) e o MCP.
import { claude, confirmar, eDoApp, gravarSettings, lerSettings, SETTINGS } from './comum.ts'

const s = lerSettings()
console.log(
  `Vai remover de ${SETTINGS} (com backup antes) o hook e a statusline do my-tokken-meter, e o MCP.`,
)
if (!(await confirmar('Remover?'))) {
  console.log('Nada foi alterado.')
  process.exit(0)
}
if (s.hooks?.UserPromptSubmit) {
  const restantes = s.hooks.UserPromptSubmit.map((g) => ({
    ...g,
    hooks: g.hooks.filter((h) => !eDoApp(h.command)),
  })).filter((g) => g.hooks.length)
  if (restantes.length) s.hooks.UserPromptSubmit = restantes
  else delete s.hooks.UserPromptSubmit
  if (!Object.keys(s.hooks).length) delete s.hooks
}
if (s.statusLine && eDoApp(s.statusLine.command)) delete s.statusLine
gravarSettings(s)
console.log(await claude(['mcp', 'remove', '--scope', 'user', 'my-tokken-meter']))
console.log('Pronto. Tudo do my-tokken-meter foi removido do Claude Code.')
