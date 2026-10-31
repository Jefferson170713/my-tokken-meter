# Arquitetura: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico) · [PRD](PRD.md) · [RULES](RULES.md) ·
[DESIGN](DESIGN.md) · [TASKS](TASKS.md)

> **Estado atual (Etapa 0):** quase tudo abaixo é **PLANEJADO**. Hoje existem só as configs da raiz (`package.json`,
> `tsconfig.json`, `eslint.config.js`, Prettier, EditorConfig, `.gitignore`), o `scripts/check-segredos.mjs`, a cópia
> de skills e agentes em `.claude/` e os docs. As demais pastas nascem nas próximas etapas ([TASKS](TASKS.md)). Os
> diagramas virão na Etapa 8.

## Visão geral

**Um processo Node ≥ 24 rodando TypeScript direto** (sem build no back; `tsconfig` com `erasableSyntaxOnly`). O
servidor `node:http` serve a API REST e, no dev, monta o **Vite em modo middleware** na mesma porta (`127.0.0.1:5178`),
sem proxy nem CORS. Persistência em `node:sqlite` (`data/meter.db`, fora do git). Sem dependências nativas
(`better-sqlite3` e `node-notifier` descartados). Fonte detalhada:
[Desenho técnico da spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico).

## Componentes

| Componente      | Estado                        | Papel                                                                                                                                                    |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`         | planejado (Etapa 2)           | paths, db, parser, ingest, prices (+ `prices.default.json`), periods, summary, config, alerts, status-file, plan                                         |
| `server/`       | planejado (Etapas 3, 4 e 6)   | `main` (API REST + Vite middleware) e `notify-windows` (toast via `powershell.exe` 5.1/WinRT)                                                            |
| `mcp/main.ts`   | planejado (Etapa 5)           | servidor MCP stdio (`@modelcontextprotocol/sdk`), **independente do app**; lê os logs pelo `core/`                                                       |
| `integrations/` | planejado (Etapas 6 e 7)      | `hook.mjs`, `statusline.mjs`, `integrar`, `desintegrar`                                                                                                  |
| `web/`          | planejado (Etapa 4)           | React: Dashboard, Historico, Configuracoes, PrimeiroUso + componentes                                                                                    |
| `tests/`        | planejado (Etapa 2 em diante) | `node:test` + fixtures **fictícias**                                                                                                                     |
| `docs/design/`  | planejado (Etapa 1)           | fonte FigCraft, SVGs das telas e ícones Lucide                                                                                                           |
| `scripts/`      | **existe**                    | `check-segredos.mjs`: varre os arquivos versionados atrás de tokens, caminhos de usuário, ids reais, `.jsonl` fora de `tests/fixtures/` e e-mail pessoal |
| `.claude/`      | **existe**                    | cópia das skills e agentes globais do fluxo (não é o `~/.claude`)                                                                                        |
| `data/`         | planejado, fora do git        | `meter.db`, `status.json` e configurações locais                                                                                                         |

## Fluxos

Todos **planejados**:

- **Ingestão:** `core/` varre `~/.claude/projects/**/*.jsonl` (inclui `<sessionId>/subagents/agent-*.jsonl`; ignora
  `tool-results/`) de forma incremental e grava no SQLite com dedupe por `PRIMARY KEY(msg_id, req_id)`. O histórico
  sobrevive quando o Claude Code apaga logs antigos.
- **Custo:** calculado na consulta a partir dos tokens; editar a tabela de preços recalcula o histórico. Modelo pelo
  nome exato ou pelo maior prefixo; sem preço → `custo=null`.
- **API REST:** `GET /api/resumo`, `/historico`, `/config` (+`PUT`), `/plano`, `/status`, `/health`. Escuta só em
  `127.0.0.1` e recusa `Host` desconhecido (DNS rebinding).
- **MCP:** só varre quando uma ferramenta é chamada (`consumo_atual`, `consumo_periodo`, `status_orcamento`). Nada de
  `console.log`: o stdout é o canal do protocolo.
- **Alertas:** id `periodo:chave:limiar`; cada canal registra o que já mostrou. O servidor grava `data/status.json`;
  hook (`UserPromptSubmit`, timeout 2 s, `systemMessage` + `additionalContext`) e statusline são `.mjs` mínimos que só
  leem esse arquivo, ficam abaixo de 300 ms e não fazem nada com o app desligado.
- **% do plano:** lida do `rate_limits` (`five_hour`, `seven_day`) que o Claude Code envia ao script da statusline,
  **sem ler o token OAuth**. Atualiza só com o Claude Code em uso.
- **Integração:** `npm run integrar`/`desintegrar` fazem backup, pedem confirmação e só mexem nas entradas do app; a
  statusline só é instalada se não houver outra (inclui o badge `[PONYTAIL]`).

## Ambientes

- **Dev:** `npm run dev` (`node server/main.ts --dev --open`) → `http://127.0.0.1:5178`; `npm run dev:back` com
  `--watch`.
- **Local sem dev:** `npm run start` (`node server/main.ts --open`).
- **MCP:** `npm run mcp`, registrado no Claude Code no escopo de usuário.
- Sem deploy em nuvem. Plataforma principal: Windows 11.
