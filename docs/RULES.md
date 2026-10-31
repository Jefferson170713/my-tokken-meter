# Regras: my-tokken-meter

Relacionados: [CLAUDE.md](../CLAUDE.md) ·
[Spec §6](specs/2026-10-31-my-tokken-meter.md#6-restrições-e-regras-que-não-podem-quebrar) ·
[ARCHITECTURE](ARCHITECTURE.md) · [MEMORY](MEMORY.md)

Regras que não podem quebrar. Fonte: `CLAUDE.md` e spec §6. Em caso de conflito, o `CLAUDE.md` manda.

## Dados

- **Repositório público:** nunca commitar logs reais (`*.jsonl` fora de `tests/fixtures/`), `.credentials.json`,
  dados de uso, configurações pessoais, tokens, e-mails ou caminhos pessoais (`C:\Users\<nome>`). Use `~` e dados
  fictícios. O `npm run check:segredos` barra isso.
- `data/` fica **fora do git** (banco e configurações locais).
- `~/.claude/**` é **somente leitura**. As únicas escritas fora do projeto são o registro do MCP, o hook e a
  statusline, via `npm run integrar`/`desintegrar`, sempre com o ok do usuário, backup e comando para desfazer.
- `~/.claude/.credentials.json`: **nunca ler**. O token OAuth nunca é gravado, logado nem enviado (a % do plano vem
  da statusline, sem token).
- Linhas `api-request*` dos logs trazem o prompt inteiro e **nunca** podem ser copiadas.
- A API escuta só em `127.0.0.1`.
- A única chamada de rede do app é a cotação PTAX do Banco Central (API pública), uma vez por dia; nenhum dado do
  usuário sai do PC.
- A conta do Claude vem de `claude auth status`, **sem ler o token**.
- Não sobrescrever a configuração do ponytail nem do ECC (hooks, statusline).

## Git

- Commits em **Conventional Commits, em português**, com os escopos da tabela do [CLAUDE.md](../CLAUDE.md).
- **Só commitar ou publicar quando o usuário pedir.**
- Branches permanentes `main` e `dev`; trabalho em `<tipo>/<palavras-chave>` a partir da `dev`.
- Antes de publicar: `npm run check:segredos` e `git status` sem nada de `data/`.

## Código

- TypeScript com `erasableSyntaxOnly`: **sem** `enum`, `namespace` ou parameter properties; use `import type`.
- Em `mcp/`, **nunca** `console.log` (o stdout é o canal do protocolo).
- Hook e statusline precisam ser rápidos (< 300 ms) e tolerar o app desligado.
- **Telas aprovadas antes do código** (Etapa 1 com portão de aprovação).
- Não tocar (formatador, linter e agentes): `data/`, `dist/`, `node_modules/`, `package-lock.json`,
  `docs/design/svg/`, `docs/design/icons/` e arquivos dos plugins (ponytail, ECC).
- Validações: `npm test && npm run lint && npm run build && npm run check:segredos`.
