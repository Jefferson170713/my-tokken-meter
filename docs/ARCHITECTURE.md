# Arquitetura: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico) · [PRD](PRD.md) · [RULES](RULES.md) ·
[DESIGN](DESIGN.md) · [TASKS](TASKS.md)

> **Estado atual (Etapa 3):** existem as configs da raiz (`package.json`, `tsconfig.json`, `eslint.config.js`,
> Prettier, EditorConfig, `.gitignore`), o `scripts/check-segredos.mjs`, a cópia de skills e agentes em `.claude/`, os
> docs, as telas aprovadas em `docs/design/`, o núcleo `core/`, a API REST em `server/main.ts` e os testes em
> `tests/`. O Vite em middleware, `mcp/`, `integrations/` e `web/` continuam **PLANEJADOS** e nascem nas próximas
> etapas ([TASKS](TASKS.md)). Os diagramas virão na Etapa 8.

## Visão geral

**Um processo Node ≥ 24 rodando TypeScript direto** (sem build no back; `tsconfig` com `erasableSyntaxOnly`). O
servidor `node:http` serve a API REST e, no dev, monta o **Vite em modo middleware** na mesma porta (`127.0.0.1:5178`),
sem proxy nem CORS. Persistência em `node:sqlite` (`data/meter.db`, fora do git). Sem dependências nativas
(`better-sqlite3` e `node-notifier` descartados). Fonte detalhada:
[Desenho técnico da spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico).

## Componentes

| Componente      | Estado                    | Papel                                                                                                                                                                                        |
| --------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`         | **existe** (Etapa 2)      | paths, db, parser, ingest, prices (+ `prices.default.json`), periods, summary, config, conta, cambio (ver [Núcleo](#núcleo-core-etapa-2)); alerts, status-file e plan virão nas Etapas 6 e 7 |
| `server/`       | **existe** (Etapa 3)      | `main.ts`: API REST (ver [API REST](#api-rest-servermaints-etapa-3)); Vite middleware (Etapa 4) e `notify-windows` (toast via `powershell.exe` 5.1/WinRT, Etapa 6) planejados                |
| `mcp/main.ts`   | planejado (Etapa 5)       | servidor MCP stdio (`@modelcontextprotocol/sdk`), **independente do app**; lê os logs pelo `core/`                                                                                           |
| `integrations/` | planejado (Etapas 6 e 7)  | `hook.mjs`, `statusline.mjs`, `integrar`, `desintegrar`                                                                                                                                      |
| `web/`          | planejado (Etapa 4)       | React: Entrar, Dashboard, Historico, Configuracoes, PrimeiroUso + componentes                                                                                                                |
| `tests/`        | **existe** (Etapas 2 e 3) | `core.test.ts` (11 testes `node:test`), `api.test.ts` (6) + fixtures **fictícias** em `tests/fixtures/projects/` (uma sessão + um subagente)                                                 |
| `docs/design/`  | **existe** (Etapa 1)      | fonte FigCraft, 20 SVGs das telas aprovadas e ícones Lucide; lista em [design/README.md](design/README.md)                                                                                   |
| `scripts/`      | **existe**                | `check-segredos.mjs`: varre os arquivos versionados atrás de tokens, caminhos de usuário, ids reais, `.jsonl` fora de `tests/fixtures/` e e-mail pessoal                                     |
| `.claude/`      | **existe**                | cópia das skills e agentes globais do fluxo (não é o `~/.claude`)                                                                                                                            |
| `data/`         | fora do git               | criada pelo `core/`: `meter.db`, `config.json` e `cambio.json` (última PTAX); `status.json` virá na Etapa 6                                                                                  |

## Núcleo `core/` (Etapa 2)

Compartilhado por API, MCP e testes. Datas e períodos usam o fuso local da máquina.

- **`paths.ts`:** `pastaLogs()` usa `MTM_CLAUDE_PROJECTS` (testes), senão `$CLAUDE_CONFIG_DIR/projects`, senão
  `~/.claude/projects`. `pastaDados()` usa `MTM_DATA_DIR`, senão `data/` relativa ao código (o MCP acha de qualquer
  cwd).
- **`db.ts`:** `abrirDb()` abre `data/meter.db` com WAL + `busy_timeout = 3000`. Tabelas:
  - `messages`: PK `(msg_id, req_id)`, `ts`, `session_id`, `project` (o `cwd` da linha), `model`, tokens `input`,
    `output`, `cw5m`, `cw1h`, `cread`, `sidechain`, `speed`; índice em `ts`.
  - `files`: `path`, `offset` (bytes já lidos) e `ignoradas` (linhas inválidas acumuladas).
- **`parser.ts`:** `parseLinha()` só aproveita `type: "assistant"` com `usage`; `<synthetic>` e os outros tipos
  (prompts, `api-request*`, `cost-state`) viram `ignorar` e nunca são copiados; JSON quebrado ou sem
  `id`/`model`/`timestamp` vira `invalida` (contada). Escrita de cache sem detalhamento 5 min/1 h (ou somando menos que
  o total) conta a diferença como 5 min.
- **`ingest.ts`:** `ingerir()` lê só os bytes novos de cada `*.jsonl`, até o último `\n` (linha parcial espera a
  próxima leitura); arquivo menor que o offset salvo é relido do zero. Uma transação por arquivo. Em conflito de PK
  grava o **maior** valor de cada coluna de tokens (o streaming grava a mesma mensagem várias vezes).
  `totalIgnoradas()` soma as linhas inválidas.
- **`prices.ts` + `prices.default.json`:** US$ por milhão de tokens, tabela atualizada em 2026-10-06 (fonte oficial
  no próprio JSON). `precoDe()` acha o modelo pelo nome exato ou pelo maior prefixo. `custo()` aplica
  `multiplicadorRapido` (Opus: 2x) quando `speed === "fast"`.
- **`periods.ts`:** `limites()` devolve o início da janela de 5h móvel e de dia, semana (segunda) e mês no fuso local;
  `chaveDia()` gera `aaaa-mm-dd` local.
- **`summary.ts`:** `resumo()` dá custo, tokens, mensagens, `semPreco` e `pct` do orçamento dos 4 períodos;
  `historico()` agrupa por dia, sessão, projeto ou modelo (agrupamento feito em JS).
- **`config.ts`:** `data/config.json` com `moeda` (`BRL`/`USD`), `unidade` (`usd`/`tokens`), `orcamentos` por
  período, `limiar` (1 a 99, padrão 80), `precos` (sobrescreve a tabela padrão) e `planoAtivo`. `validarConfig()` é a
  fronteira de confiança do futuro `PUT /api/config`; a gravação é atômica (arquivo temporário + `rename`).
- **`conta.ts`:** `lerConta()` roda `claude auth status` (timeout 10 s) e devolve só `conectada`, `email`, `plano`,
  `metodo` e `pastaLogs`. Binário: `MTM_CLAUDE_BIN`, senão o nativo da extensão do VS Code
  (`~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/`), senão `claude` do PATH.
- **`cambio.ts`:** `obterCotacao()` pega a PTAX de venda mais recente dos últimos 7 dias (cobre fim de semana e
  feriado), com timeout de 5 s e cache de um dia em `data/cambio.json`; sem internet devolve a salva com
  `antiga: true`, ou `null` se nunca buscou.

## API REST `server/main.ts` (Etapa 3)

`criarServidor({ porta, dados, logs })` monta o servidor `node:http` sem escutar (os testes usam pasta temporária e
as fixtures); rodando direto (`node server/main.ts`), escuta em `127.0.0.1` na porta `MTM_PORTA` (padrão 5178) e avisa
se a porta já estiver em uso. As flags `--dev --open` do `package.json` ainda não são lidas (Vite e navegador:
Etapa 4).

- **Host:** só aceita `Host` igual a `127.0.0.1:<porta>` ou `localhost:<porta>`; outro recebe 403 (DNS rebinding
  contra o `PUT /api/config`). Com porta 0 (testes), a porta aceita passa a ser a que o sistema escolheu.
- **Leitura dos logs:** uma ao subir e depois a cada 30 s em segundo plano; o `GET /api/resumo` também lê na hora se a
  última leitura tem mais de 5 s.
- **Respostas:** JSON com `cache-control: no-store`; rota inexistente 404; erro inesperado 500 (`erro interno`, detalhe
  só no console).

| Rota                 | O que faz                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | `{ ok: true }`                                                                                                                                                                                                         |
| `GET /api/resumo`    | `periodos` (`resumo()` dos 4 períodos), `moeda`, `unidade`, `limiar`, `cotacao`, `linhasIgnoradas`, `ultimaLeitura` (ms), `tabelaPrecos`. Pasta de logs inexistente: 503 `{ erro: 'pasta-nao-encontrada', pastaLogs }` |
| `GET /api/historico` | `?agrupar=dia\|sessao\|projeto\|modelo` (padrão `dia`), `de` e `ate` em ms (padrão: os últimos 14 dias). Agrupamento ou período inválido: 400                                                                          |
| `GET /api/config`    | `data/config.json` com os padrões                                                                                                                                                                                      |
| `PUT /api/config`    | corpo JSON até 64 KB (acima: 413), validado por `salvarConfig()`; JSON quebrado ou config inválida: 400 com a mensagem                                                                                                 |
| `GET /api/conta`     | `lerConta()` (`claude auth status`), em cache por 60 s                                                                                                                                                                 |
| `GET /api/cambio`    | `obterCotacao()` (PTAX do dia ou a última salva)                                                                                                                                                                       |

`/api/status` (Etapa 6) e `/api/plano` (Etapa 7) ainda não existem.

## Fluxos

O que já existe no `core/` (Etapa 2) está marcado; o resto é **planejado**.

- **Ingestão (existe):** `core/ingest.ts` varre recursivamente os `*.jsonl` de `~/.claude/projects/` (inclui
  `<sessionId>/subagents/agent-*.jsonl`) de forma incremental e grava no SQLite com dedupe por
  `PRIMARY KEY(msg_id, req_id)`. O filtro é só a extensão `.jsonl` (`core/ingest.ts:12`); `tool-results/` não é
  excluída pelo caminho. O histórico sobrevive quando o Claude Code apaga logs antigos (coberto em
  `tests/core.test.ts`).
- **Custo (existe):** calculado na consulta a partir dos tokens (`core/summary.ts`); editar a tabela de preços (padrão
  mais `config.precos`) recalcula o histórico. Modelo pelo nome exato ou pelo maior prefixo; sem preço, os tokens contam,
  o custo não, e o modelo entra em `semPreco` (`custoUsd` é sempre número, não existe `custo=null`).
- **API REST (existe):** rotas e regras em [API REST](#api-rest-servermaints-etapa-3). Escuta só em `127.0.0.1` e
  recusa `Host` desconhecido (DNS rebinding). `/plano` e `/status` virão nas Etapas 7 e 6.
- **MCP:** só varre quando uma ferramenta é chamada (`consumo_atual`, `consumo_periodo`, `status_orcamento`). Nada de
  `console.log`: o stdout é o canal do protocolo.
- **Alertas:** id `periodo:chave:limiar`; cada canal registra o que já mostrou. O servidor grava `data/status.json`;
  hook (`UserPromptSubmit`, timeout 2 s, `systemMessage` + `additionalContext`) e statusline são `.mjs` mínimos que só
  leem esse arquivo, ficam abaixo de 300 ms e não fazem nada com o app desligado.
- **% do plano:** lida do `rate_limits` (`five_hour`, `seven_day`) que o Claude Code envia ao script da statusline,
  **sem ler o token OAuth**. Atualiza só com o Claude Code em uso.
- **Conta (existe no `core/`):** `core/conta.ts` roda `claude auth status` e usa o JSON (`loggedIn`, `authMethod`,
  `email`, `subscriptionType`, `projectsDirectory`); nunca lê o token. Sem conta, o front (planejado) mostra
  `claude auth login`.
- **Câmbio (existe no `core/`):** `core/cambio.ts` busca a PTAX do Banco Central uma vez por dia e guarda a última
  cotação em `data/cambio.json`; offline, usa a salva. É a **única chamada de rede** do app. Os orçamentos ficam
  **guardados em US$ ou em tokens** (`config.unidade`, `core/config.ts:10`); a moeda escolhida (R$ | US$) é só
  exibição; a API entrega a cotação junto (`cotacao` no `/api/resumo` e `/api/cambio`) e a conversão fica para o front
  (Etapa 4).
- **Integração:** `npm run integrar`/`desintegrar` fazem backup, pedem confirmação e só mexem nas entradas do app; a
  statusline só é instalada se não houver outra (inclui o badge `[PONYTAIL]`).

## Ambientes

- **Dev:** `npm run dev` (`node server/main.ts --dev --open`) → `http://127.0.0.1:5178`; `npm run dev:back` com
  `--watch`. Hoje (Etapa 3) sobe só a API; Vite e abrir o navegador chegam na Etapa 4. Porta: `MTM_PORTA`.
- **Local sem dev:** `npm run start` (`node server/main.ts --open`).
- **MCP:** `npm run mcp`, registrado no Claude Code no escopo de usuário.
- Sem deploy em nuvem. Plataforma principal: Windows 11.
