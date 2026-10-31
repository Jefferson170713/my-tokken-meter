# Tarefas: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#andamento) · [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md)
· [DESIGN](DESIGN.md)

Etapas da spec. Branch de cada uma em [spec, Branches](specs/2026-10-31-my-tokken-meter.md#branches).

## Em aberto

- [ ] **1. Telas** — tokens + componentes + 8 telas × 2 temas no FigCraft, SVGs e ícones. Pronto: 16 SVGs em
      `docs/design/svg/` aprovados pelo usuário.
- [ ] **2. `core/`** — parser, ingest incremental, SQLite, períodos, preços. Pronto: testes `node:test` de dedupe,
      `<synthetic>`, leitura incremental, períodos/fuso e preços passando.
- [ ] **3. API REST** — `node:http` em 127.0.0.1:5178 com checagem de Host. Pronto: rotas `/api/*` respondem e Host
      desconhecido é recusado.
- [ ] **4. Front** — Vite em middleware; dashboard, histórico, configurações, tema. Pronto: `npm run dev` abre o
      dashboard e o tema alternado fica salvo.
- [ ] **5. Servidor MCP** — stdio, SDK oficial, independente do app. Pronto: o Claude responde "quanto já usei hoje?"
      com os números do app.
- [ ] **6. Alertas** — motor, toast do Windows, banner, `Notification`, hook, statusline, `integrar`/`desintegrar`.
      Pronto: aos 80% os quatro avisos aparecem uma vez; hook < 300 ms e silencioso com o app desligado.
- [ ] **7. % do plano** — pelo `rate_limits` da statusline. Pronto: o card mostra 5h e semana, ou "indisponível" sem
      quebrar o resto.
- [ ] **8. Publicação** — README, diagramas, `check-segredos` e publicação. Pronto: `check-segredos` limpo e repo
      público sem log, token ou dado pessoal.

## Concluídas

- [x] 2026-10-31 · **0. Preparar o projeto** — `.gitignore`, configs (TypeScript, ESLint, Prettier, EditorConfig),
      `CLAUDE.md`, `scripts/check-segredos.mjs`, `LICENSE` MIT, cópia de skills/agentes em `.claude/` e `docs/`.
