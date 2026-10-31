# Tarefas: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#andamento) · [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md)
· [DESIGN](DESIGN.md)

Etapas da spec. Branch de cada uma em [spec, Branches](specs/2026-10-31-my-tokken-meter.md#branches).

## Em aberto

- [ ] **3. API REST** — `node:http` em 127.0.0.1:5178 com checagem de Host; expõe também a conta e a cotação.
      Pronto: rotas `/api/*` respondem, Host desconhecido é recusado e a PTAX é a única chamada de rede.
- [ ] **4. Front** — Vite em middleware; telas de [DESIGN](DESIGN.md#telas-etapa-1): entrada (conectada e sem conta),
      dashboard, histórico, configurações (cards "Conta do Claude" e "Moeda"), tema e seletor R$ | US$. Pronto:
      `npm run dev` abre o dashboard, o tema alternado fica salvo e os valores trocam entre R$ e US$.
- [ ] **5. Servidor MCP** — stdio, SDK oficial, independente do app. Pronto: o Claude responde "quanto já usei hoje?"
      com os números do app.
- [ ] **6. Alertas** — motor, toast do Windows, banner, `Notification`, hook, statusline, `integrar`/`desintegrar`.
      Pronto: aos 80% os quatro avisos aparecem uma vez; hook < 300 ms e silencioso com o app desligado.
- [ ] **7. % do plano** — pelo `rate_limits` da statusline. Pronto: o card mostra 5h e semana, ou "indisponível" sem
      quebrar o resto.
- [ ] **8. Publicação** — README, diagramas, `check-segredos` e publicação. Pronto: `check-segredos` limpo e repo
      público sem log, token ou dado pessoal.

## Concluídas

- [x] 2026-10-31 · **2. `core/`** — parser, ingest incremental, SQLite, períodos, preços, `summary.ts`,
      `config.ts`, `conta.ts` (via `claude auth status`) e `cambio.ts` (PTAX do Banco Central, 1x por dia, cache em
      `data/cambio.json`). 10 testes `node:test` em `tests/core.test.ts` (dedupe, `<synthetic>`, leitura incremental,
      períodos com `TZ` fixo, preços, resumo, config, conta com e sem login, câmbio offline). Conferido com logs reais:
      1ª leitura 169 ms (298 mensagens), 2ª 16 ms. Detalhes em [ARCHITECTURE](ARCHITECTURE.md#núcleo-core-etapa-2).
- [x] 2026-10-31 · **1. Telas** — 10 telas × 2 temas = 20 SVGs em `docs/design/svg/` (inclui as duas de entrada),
      fonte `docs/design/my-tokken-meter.figcraft` e ícones Lucide em `docs/design/icons/`, aprovados pelo usuário.
      Lista em [docs/design/README.md](design/README.md).
- [x] 2026-10-31 · **0. Preparar o projeto** — `.gitignore`, configs (TypeScript, ESLint, Prettier, EditorConfig),
      `CLAUDE.md`, `scripts/check-segredos.mjs`, `LICENSE` MIT, cópia de skills/agentes em `.claude/` e `docs/`.
