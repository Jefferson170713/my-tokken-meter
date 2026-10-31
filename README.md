# my-tokken-meter

Medidor **local** do seu consumo do [Claude Code](https://claude.com/claude-code): janela de 5 horas, dia, semana e
mês, em US$ estimado e tokens, com alertas quando você chega a 80% e 100% do orçamento que definiu.

> 🚧 Em construção. O plano completo está em [`docs/specs/2026-10-31-my-tokken-meter.md`](docs/specs/2026-10-31-my-tokken-meter.md).

## O que vai ter

- Dashboard no navegador, tema claro e escuro.
- Leitura dos logs locais do Claude Code (`~/.claude/projects`), sem enviar nada para fora.
- % real do plano (5h e semana) lida da statusline do Claude Code, sem usar o seu token.
- Alertas: banner, notificação do Windows, aviso dentro do Claude Code e statusline.
- API REST local e servidor MCP, para o próprio Claude responder "quanto já usei hoje?".

## Rodar

Requer Node.js 24 ou mais novo.

```bash
npm install
npm run dev
```

## Licença

[MIT](LICENSE). Ícones: [Lucide](https://lucide.dev) (ISC).
