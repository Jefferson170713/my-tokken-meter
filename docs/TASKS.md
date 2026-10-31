# Tarefas: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#andamento) · [PRD](PRD.md) · [ARCHITECTURE](ARCHITECTURE.md)
· [DESIGN](DESIGN.md)

Etapas da spec. Branch de cada uma em [spec, Branches](specs/2026-10-31-my-tokken-meter.md#branches).

## Em aberto

- [ ] **Diagramas Mermaid** — previstos na Etapa 8 e ainda não feitos: componentes (servidor, front, MCP, hook,
      statusline, `data/`) e o fluxo dos alertas. Pronto: diagramas no `docs/` com link no README e no
      [ARCHITECTURE](ARCHITECTURE.md), conferidos com o código.
- [ ] **Telas 02 e 03 no FigCraft** — "Dashboard com alerta" e "Sem orçamento" ainda têm os cards no formato antigo,
      sem o rodapé "Renova em…" da tela 01. Pronto: as duas telas (claro e escuro) com o rodapé, SVGs exportados de
      novo e aprovados pelo usuário.
- [ ] **Notificação do navegador (`Notification`)** — prevista na Etapa 6 (spec §4 e §5, "Alertas"), mas não há uso
      em `web/src/`; hoje os avisos são banner, toast do Windows, hook e statusline. Pronto: o usuário decide se entra;
      se entrar, a aba aberta mostra a notificação uma vez por alerta (sem repetir os ids já vistos) e a permissão só é
      pedida por ação do usuário.

## Concluídas

- [x] 2026-10-31 · **8. Publicação** — README final (o que tem, rodar, `npm.cmd` no PowerShell, integrar, comandos
      de desenvolvimento), `check-segredos` limpo, 23 testes (11 `core`, 6 API, 6 integrações). Diagramas ficaram em
      aberto (acima).
- [x] 2026-10-31 · **7. % do plano** — `core/plan.ts` (`extrairPlano` do `rate_limits` com `resets_at` em segundos,
      ms ou ISO; `lerPlano`); a statusline grava `data/plano.json` e o `/api/resumo` devolve `plano` quando
      `planoAtivo`. Card "Plano Claude" ao lado do gráfico, com "ainda sem dados" quando falta. Não há rota
      `/api/plano`. Detalhes em [ARCHITECTURE](ARCHITECTURE.md#sessão-alertas-e-plano-core-etapas-67).
- [x] 2026-10-31 · **6. Alertas** — `core/alerts.ts` (80/100, id por período, `filtrarNovos` por canal,
      `gravarJson` atômico); o servidor grava `data/status.json` a cada leitura e manda o toast do Windows
      (`server/notify-windows.ts`); banner no painel; `integrations/hook.mjs` (`UserPromptSubmit`) e
      `statusline.mjs`; `npm run integrar`/`desintegrar` com backup e confirmação (testados pelo usuário). Sessão de
      5h estimada em `core/sessao.ts`. Não há rota `/api/status` (o arquivo cumpre o papel) e a `Notification` do
      navegador ficou em aberto. Detalhes em
      [ARCHITECTURE](ARCHITECTURE.md#integrações-com-o-claude-code-integrations-etapas-67).
- [x] 2026-10-31 · **5. Servidor MCP** — `mcp/main.ts` (stdio, SDK oficial) com `consumo_atual`, `consumo_periodo` e
      `status_orcamento`; lê os logs só quando uma ferramenta é chamada; teste com handshake real. Detalhes em
      [ARCHITECTURE](ARCHITECTURE.md#servidor-mcp-mcpmaints-etapa-5).
- [x] 2026-10-31 · **4. Front** — `web/` em React: Entrar, Dashboard, Histórico, Configurações, `Sessao.tsx`
      (`Renovacao` e `CardPlano`); Vite em middleware com `--dev`, `--open` abre o navegador, `npm start` serve
      `dist/`; fontes locais (`@fontsource`); rota `GET /api/precos`. Login guardado em `data/conta.json` até o botão
      Sair (`POST /api/entrar`, `POST /api/sair`). Rodapé "Renova em…" nos 4 cards, desenhado antes no FigCraft.
      Detalhes em [ARCHITECTURE](ARCHITECTURE.md#front-web-etapa-4).
- [x] 2026-10-31 · **3. API REST** — `server/main.ts` em `node:http` (127.0.0.1:5178 ou `MTM_PORTA`), `Host` e
      `Origin` desconhecidos recebem 403; rotas `health`, `resumo`, `historico`, `config` (+`PUT` validado, até
      64 KB), `conta` (cache 60 s) e `cambio`; leitura dos logs a cada 30 s e sob demanda no `resumo`. 6 testes em
      `tests/api.test.ts` (17 no total). Conferido com logs reais: custo do dia US$ 32,21 / 351 mensagens, PTAX
      R$ 5,4212. Detalhes em [ARCHITECTURE](ARCHITECTURE.md#api-rest-servermaints-etapa-3).
- [x] 2026-10-31 · **2. `core/`** — parser, ingest incremental, SQLite, períodos, preços, `summary.ts`,
      `config.ts`, `conta.ts` (via `claude auth status`) e `cambio.ts` (PTAX do Banco Central, 1x por dia, cache em
      `data/cambio.json`). 11 testes `node:test` em `tests/core.test.ts` (dedupe, `<synthetic>`, leitura incremental,
      períodos com `TZ` fixo, horário de verão, preços, resumo, config, conta com e sem login, câmbio offline).
      Conferido com logs reais: 1ª leitura 169 ms (298 mensagens), 2ª 16 ms. Detalhes em
      [ARCHITECTURE](ARCHITECTURE.md#núcleo-core-etapa-2).
- [x] 2026-10-31 · **1. Telas** — 10 telas × 2 temas = 20 SVGs em `docs/design/svg/` (inclui as duas de entrada),
      fonte `docs/design/my-tokken-meter.figcraft` e ícones Lucide em `docs/design/icons/`, aprovados pelo usuário.
      Lista em [docs/design/README.md](design/README.md).
- [x] 2026-10-31 · **0. Preparar o projeto** — `.gitignore`, configs (TypeScript, ESLint, Prettier, EditorConfig),
      `CLAUDE.md`, `scripts/check-segredos.mjs`, `LICENSE` MIT, cópia de skills/agentes em `.claude/` e `docs/`.
