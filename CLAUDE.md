# my-tokken-meter

Medidor **local** do consumo do Claude Code (janela de 5h, dia, semana e mês), com alertas aos 80% e 100% do
orçamento, API REST para o navegador e servidor MCP para o Claude consultar. Roda com `npm run dev`.

- Idioma: português (código, commits, textos da interface).
- Stack: Node ≥ 24 rodando TypeScript direto (sem build no back), `node:http`, `node:sqlite`, Vite + React no front,
  `@modelcontextprotocol/sdk` no MCP, ícones Lucide. Detalhes em `docs/specs/2026-10-31-my-tokken-meter.md`.
- TypeScript com `erasableSyntaxOnly`: **sem** `enum`, `namespace` ou parameter properties; use `import type`.
- Repositório **público**: `Jefferson170713/my-tokken-meter`.

## Estrutura

Estrutura planejada na spec. Hoje (Etapa 3) existem `core/`, `server/`, `tests/`, `scripts/`, `docs/` (specs, docs principais e `design/` com as telas
aprovadas), `.claude/` e as configs da raiz; as demais pastas nascem nas próximas etapas.

| Pasta           | O que tem                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `core/`         | Leitura dos logs, SQLite, períodos, preços, alertas — compartilhado por API, MCP e testes                                       |
| `server/`       | API REST (127.0.0.1:5178) + Vite em middleware no dev + notificação do Windows                                                  |
| `mcp/`          | Servidor MCP (stdio). Nunca usar `console.log` aqui: o stdout é o canal do protocolo                                            |
| `integrations/` | Hook e statusline do Claude Code + `integrar`/`desintegrar`                                                                     |
| `web/`          | Front React                                                                                                                     |
| `tests/`        | `node:test` + fixtures **fictícias**                                                                                            |
| `scripts/`      | `check-segredos.mjs`                                                                                                            |
| `docs/`         | Docs principais (PRD, ARCHITECTURE, RULES, DESIGN, MEMORY, TASKS), `specs/` (planos do /pmo), `design/` (telas SVG do FigCraft) |
| `data/`         | Banco e configurações locais — **fora do git**                                                                                  |
| `.claude/`      | Cópia das skills e agentes globais usados no fluxo (não é o `~/.claude`); fora do Prettier                                      |

## Fluxo de trabalho

- Branches permanentes: `main` (publicada) e `dev`. Origem padrão das tarefas: `dev`. Depois do merge na `dev`, levar
  para a `main` quando o usuário pedir.
- Branch de trabalho: `<tipo>/<palavras-chave>` (tipos do Conventional Commits). Mudança pequena vai direto na origem.
- Planejamento: `/pmo` → spec em `docs/specs/<aaaa-mm-dd>-<assunto>.md` → agente `tech-lead`.
- Execução: `/iniciar-commit` → trabalho e teste do usuário → `/finalizar-commit` (agentes `linter` e `documentador`,
  `diagramador` se a estrutura mudou, commit, merge).
- **Telas aprovadas antes do código** (Etapa 1 da spec).
- Documentação: `docs/`, mantida pelo `documentador`: [PRD](docs/PRD.md), [ARCHITECTURE](docs/ARCHITECTURE.md),
  [RULES](docs/RULES.md), [DESIGN](docs/DESIGN.md), [MEMORY](docs/MEMORY.md), [TASKS](docs/TASKS.md) e
  `docs/specs/`.
- Commits: Conventional Commits em português; só commitar ou publicar quando o usuário pedir.

### Como testar localmente

`npm install` (uma vez) → `npm run dev` → abre `http://127.0.0.1:5178`

### Validações

`npm test && npm run lint && npm run build && npm run check:segredos` — e `git status` sem nada de `data/`.

### Não tocar (formatador, linter e agentes)

- `~/.claude/**`: **somente leitura**. Exceção: `npm run integrar`/`desintegrar`, sempre com o ok do usuário e
  backup.
- `~/.claude/.credentials.json`: **nunca ler**.
- `data/`, `dist/`, `node_modules/`, `package-lock.json`, `docs/design/svg/`, `docs/design/icons/`.
- Arquivos dos plugins (ponytail, ECC).
- Nunca commitar logs reais (`*.jsonl` fora de `tests/fixtures/`), tokens, e-mails ou caminhos pessoais
  (`C:\Users\<nome>`): use `~` e dados fictícios. O `check-segredos` barra isso.

### Escopos de commit

| Escopo        | Pastas/arquivos                                         |
| ------------- | ------------------------------------------------------- |
| `core`        | `core/`                                                 |
| `api`         | `server/`                                               |
| `web`         | `web/`, `vite.config.ts`                                |
| `mcp`         | `mcp/`                                                  |
| `alertas`     | `core/alerts.ts`, `server/notify-windows.ts`            |
| `integracoes` | `integrations/`                                         |
| `plano`       | `core/plan.ts`                                          |
| `design`      | `docs/design/`                                          |
| `testes`      | `tests/`                                                |
| `docs`        | `README.md`, `CLAUDE.md`, `docs/*.md`, `docs/specs/`    |
| `config`      | `package.json`, configs na raiz, `scripts/`, `.claude/` |
