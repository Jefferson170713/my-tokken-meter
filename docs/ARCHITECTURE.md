# Arquitetura: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico) · [PRD](PRD.md) · [RULES](RULES.md) ·
[DESIGN](DESIGN.md) · [TASKS](TASKS.md)

> **Estado atual (Etapas 0–8):** todas as pastas da estrutura existem: configs da raiz, `scripts/check-segredos.mjs`,
> `.claude/`, os docs e as telas em `docs/design/`, o núcleo `core/`, a API e o front servidos por `server/main.ts`, o
> front React em `web/`, o servidor MCP em `mcp/main.ts`, as integrações com o Claude Code em `integrations/` e 23
> testes em `tests/`. Os diagramas Mermaid ainda não foram feitos ([TASKS](TASKS.md)).

## Visão geral

**Um processo Node ≥ 24 rodando TypeScript direto** (sem build no back; `tsconfig` com `erasableSyntaxOnly`). O
servidor `node:http` serve a API REST e, no dev, monta o **Vite em modo middleware** na mesma porta (`127.0.0.1:5178`),
sem proxy nem CORS; no `npm start`, serve o front já compilado de `dist/`. Persistência em `node:sqlite`
(`data/meter.db`, fora do git). Sem dependências nativas (`better-sqlite3` e `node-notifier` descartados). O servidor
MCP é **outro processo** (stdio), aberto pelo Claude Code, que lê os logs pelo mesmo `core/`. Fonte detalhada:
[Desenho técnico da spec](specs/2026-10-31-my-tokken-meter.md#desenho-técnico).

## Componentes

| Componente      | Estado                    | Papel                                                                                                                                                                                                                                                   |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`         | **existe** (Etapas 2–7)   | paths, db, parser, ingest, prices (+ `prices.default.json`), periods, summary, config, conta, cambio (ver [Núcleo](#núcleo-core-etapa-2)); `sessao.ts`, `alerts.ts` e `plan.ts` (ver [Sessão, alertas e plano](#sessão-alertas-e-plano-core-etapas-67)) |
| `server/`       | **existe** (Etapas 3–6)   | `main.ts`: API REST (ver [API REST](#api-rest-servermaints-etapa-3)), Vite em middleware (`--dev`) ou `dist/`, grava `data/status.json`; `notify-windows.ts`: toast via `powershell.exe` 5.1/WinRT                                                      |
| `web/`          | **existe** (Etapa 4)      | front React (ver [Front](#front-web-etapa-4))                                                                                                                                                                                                           |
| `mcp/main.ts`   | **existe** (Etapa 5)      | servidor MCP stdio (`@modelcontextprotocol/sdk`), **independente do app**; lê os logs pelo `core/` (ver [MCP](#servidor-mcp-mcpmaints-etapa-5))                                                                                                         |
| `integrations/` | **existe** (Etapas 6 e 7) | `hook.mjs`, `statusline.mjs`, `integrar.ts`, `desintegrar.ts`, `comum.ts` (ver [Integrações](#integrações-com-o-claude-code-integrations-etapas-67))                                                                                                    |
| `tests/`        | **existe** (Etapas 2–7)   | 23 testes `node:test`: `core.test.ts` (11), `api.test.ts` (6), `integracoes.test.ts` (6: sessão, alertas, plano, hook e statusline como processos, handshake MCP real) + fixtures **fictícias** em `tests/fixtures/projects/`                           |
| `docs/design/`  | **existe** (Etapa 1)      | fonte FigCraft, 20 SVGs das telas, `previa-dashboard-escuro.png` (dashboard com o rodapé de renovação) e ícones Lucide; lista em [design/README.md](design/README.md)                                                                                   |
| `scripts/`      | **existe**                | `check-segredos.mjs`: varre os arquivos versionados atrás de tokens, caminhos de usuário, ids reais, `.jsonl` fora de `tests/fixtures/` e e-mail pessoal                                                                                                |
| `.claude/`      | **existe**                | cópia das skills e agentes globais do fluxo (não é o `~/.claude`)                                                                                                                                                                                       |
| `data/`         | fora do git               | criada em tempo de uso (ver [Arquivos em `data/`](#arquivos-em-data))                                                                                                                                                                                   |

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
  fronteira de confiança do `PUT /api/config`; a gravação é atômica (arquivo temporário + `rename`).
- **`conta.ts`:** `lerConta()` roda `claude auth status` (timeout 10 s) e devolve só `conectada`, `email`, `plano`,
  `metodo` e `pastaLogs`. Binário (`acharClaude()`, também usado pelo `integrar`): `MTM_CLAUDE_BIN`, senão o nativo da
  extensão do VS Code (`~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/`), senão `claude` do
  PATH.
- **`cambio.ts`:** `obterCotacao()` pega a PTAX de venda mais recente dos últimos 7 dias (cobre fim de semana e
  feriado), com timeout de 5 s e cache de um dia em `data/cambio.json`; sem internet devolve a salva com
  `antiga: true`, ou `null` se nunca buscou.

## Sessão, alertas e plano `core/` (Etapas 6–7)

- **`sessao.ts`:** `sessaoAtual()` estima a sessão de 5h do plano pelos logs das últimas 24 h: a sessão abre na **hora
  cheia** da primeira mensagem, dura 5 h, e a próxima abre na primeira mensagem depois disso; sem sessão aberta devolve
  `null`. Traz `inicio`, `fim`, `custoUsd`, `tokens`, `mensagens` e `serie` (20 fatias de 15 min). Hoje a `serie` vai
  no `/api/resumo`, mas nenhuma tela a desenha. É diferente do período `janela5h` de `periods.ts`, que continua
  **móvel** (últimas 5 h) e é a base da % do orçamento de 5h.
- **`alerts.ts`:**
  - `alertasAtivos(periodos, limiar)`: um alerta por período com `pct ≥ limiar`; nível `100` a partir de 100%, senão
    `80` (o nível se chama 80 mesmo com outro limiar). Id `periodo:chave:nivel`; a chave é o dia de início do período
    (`chaveDia`), e na `janela5h` é o dia de hoje (no máximo um aviso de 5h por nível por dia). Textos prontos ("Restam
    X% do orçamento de hoje…", "Limite do orçamento … atingido").
  - `filtrarNovos(arquivo, alertas)`: devolve só os ids que aquele canal ainda não mostrou e grava os vistos, podando
    os de mais de 40 dias.
  - `gravarJson()`: gravação atômica (temporário + `rename`); se o Windows der `EPERM` com o arquivo aberto, descarta e
    tenta na próxima rodada.
- **`plan.ts`:** `extrairPlano()` lê `rate_limits.five_hour` e `seven_day` (`used_percentage`, `resets_at`) do JSON
  que o Claude Code manda à statusline; `paraMs()` aceita `resets_at` em segundos, milissegundos ou texto ISO. Sem
  nenhuma das duas % devolve `null`. `lerPlano()` lê `data/plano.json` (gravado pela statusline).
- **Horário de renovação da 5h:** o horário oficial (`plano.renova5h`, se ainda no futuro) tem prioridade; senão vale
  o `fim` da `sessaoAtual()` (estimado). A mesma regra aparece em `server/main.ts:92`, `mcp/main.ts:52`,
  `integrations/statusline.mjs:54` e `web/src/Sessao.tsx:18-19`.

## API REST `server/main.ts` (Etapa 3)

`criarServidor({ porta, dados, logs, front, avisar })` monta o servidor `node:http` sem escutar (os testes usam pasta
temporária e as fixtures); rodando direto (`node server/main.ts`), escuta em `127.0.0.1` na porta `MTM_PORTA` (padrão
5178; valor fora de 1–65535 encerra com erro) e avisa se a porta já estiver em uso.

- **Host:** só aceita `Host` igual a `127.0.0.1:<porta>` ou `localhost:<porta>`; outro recebe 403 (DNS rebinding
  contra o `PUT /api/config`). Com porta 0 (testes), a porta aceita passa a ser a que o sistema escolheu.
- **Origin:** se vier o cabeçalho `Origin` e não for `http://127.0.0.1:<porta>` nem `http://localhost:<porta>`, 403
  (`origem não permitida`), inclusive nos GETs (`server/main.ts:175-178`).
- **Front:** rota que não é da API e não existe no mapa vai para o middleware do front: Vite com `--dev`
  (`server/main.ts:239-247`), senão `servirDist()`, que serve `dist/` e devolve `index.html` para qualquer outro
  caminho (sem `dist/index.html`, avisa "rode npm run build").
- **`--open`:** abre o navegador ao subir (`cmd /c start` no Windows, `open`/`xdg-open` fora dele).
- **Leitura dos logs:** uma ao subir e depois a cada 30 s em segundo plano; o `GET /api/resumo` também lê na hora se a
  última leitura tem mais de 5 s. Cada leitura sem erro grava `data/status.json` e, no processo principal
  (`avisar: true`), manda o toast do Windows dos alertas novos (ver [Fluxos](#fluxos)).
- **Respostas:** JSON com `cache-control: no-store`; rota inexistente 404; erro inesperado 500 (`erro interno`, detalhe
  só no console).

| Rota                 | O que faz                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | `{ ok: true }`                                                                                                                                                                                                                                                                                                      |
| `GET /api/resumo`    | `periodos` (`resumo()` dos 4 períodos), `moeda`, `unidade`, `limiar`, `cotacao`, `linhasIgnoradas`, `ultimaLeitura` (ms), `tabelaPrecos`, `sessao` (`sessaoAtual()` ou `null`) e `plano` (`lerPlano()` se `planoAtivo`, senão `null`). Pasta de logs inexistente: 503 `{ erro: 'pasta-nao-encontrada', pastaLogs }` |
| `GET /api/historico` | `?agrupar=dia\|sessao\|projeto\|modelo` (padrão `dia`), `de` e `ate` em ms (padrão: os últimos 14 dias). Agrupamento ou período inválido: 400                                                                                                                                                                       |
| `GET /api/config`    | `data/config.json` com os padrões                                                                                                                                                                                                                                                                                   |
| `PUT /api/config`    | corpo JSON até 64 KB (acima: 413), validado por `salvarConfig()`; JSON quebrado ou config inválida: 400 com a mensagem                                                                                                                                                                                              |
| `GET /api/conta`     | `lerConta()` (`claude auth status`), em cache por 60 s, + `entrou` (`data/conta.json` com `logado: true`) e `ultima` (o conteúdo de `data/conta.json`)                                                                                                                                                              |
| `POST /api/entrar`   | relê a conta; sem conta conectada, 409. Com conta, grava `data/conta.json` (`email`, `plano`, `metodo`, `entrouEm`, `logado: true`) e devolve a conta com `entrou: true`                                                                                                                                            |
| `POST /api/sair`     | regrava `data/conta.json` com `logado: false` (mantém o último acesso); `{ ok: true }`                                                                                                                                                                                                                              |
| `GET /api/cambio`    | `obterCotacao()` (PTAX do dia ou a última salva)                                                                                                                                                                                                                                                                    |
| `GET /api/precos`    | tabela de preços padrão (`padrao`) + `atualizadoEm` e `fonte`; usada pelo card "Preços por modelo" das Configurações                                                                                                                                                                                                |

As rotas `/api/status` e `/api/plano` do desenho original **não existem**: o status para hook e statusline é o
arquivo `data/status.json`, e o plano vem dentro do `/api/resumo` (`server/main.ts:99-162`).

## Front `web/` (Etapa 4)

React 19 + Vite (`vite.config.ts`: `root: 'web'`, build em `dist/`). Ícones `lucide-react`; fontes IBM Plex Sans e
JetBrains Mono do `@fontsource` importadas em `web/src/main.tsx` (sem rede). Tokens de cor em
`web/src/styles.css` (ver [DESIGN](DESIGN.md#tokens-de-cor-aa)).

- **`App.tsx`:** mostra `Entrar` até a conta entrar; depois, barra lateral (Visão geral, Histórico, Configurações,
  status da leitura, botão **Sair** → `POST /api/sair`, tema Escuro/Claro) e rotas por hash (`#/`, `#/historico`,
  `#/config`). Busca o `/api/resumo` a cada 15 s. Tema salvo no `localStorage` (`mtm-tema`), escuro por padrão.
- **`Entrar.tsx`:** pede `GET /api/conta`; se `entrou` já for `true`, segue direto para o painel. Conectada: botão que
  chama `POST /api/entrar` e linha "Último acesso: … em …". Sem conta: `claude auth login` e "Verificar de novo".
- **`Dashboard.tsx`:** cabeçalho com seletor R$ | US$; banners de alerta 80/100% (dispensáveis, guardados no
  `localStorage` em `mtm-avisos`) e de "sem orçamento"; 4 cards (5h, dia, semana, mês), cada um com o rodapé
  `Renovacao`; gráfico dos últimos 14 dias + card `CardPlano`; tabelas por modelo e por projeto (hoje); estados de
  erro (503 = pasta de logs), vazio e primeiro uso (`mtm-onboarding`).
- **`Sessao.tsx`:** `Renovacao` (rodapé "Renova em…", horário, barra e % do tempo já passado; 5h: horário oficial ou
  estimado, com "(estimado)"; dia: meia-noite; semana: segunda seguinte; mês: dia 1º) e `CardPlano` (% real da 5h e da
  semana com horário de renovação, ou instrução para instalar a statusline).
- **`Historico.tsx`:** abas por dia, sessão, projeto e modelo. **`Configuracoes.tsx`:** orçamentos, limiar, preços por
  modelo (`/api/precos`), Conta do Claude, Moeda, Plano Claude (liga/desliga `planoAtivo`), Integrações (comandos
  `npm run integrar`/`desintegrar`) e Aparência.
- **`api.ts`** (cliente e tipos, importados de `core/` com `import type`), **`format.ts`** (moeda, tokens, datas; sem
  cotação mostra US$) e **`ui.tsx`** (`Barra`, `Banner`, `Segmentos`, `Alternar`, `Cabecalho`, `nivel()`, acesso
  seguro ao `localStorage`).

## Servidor MCP `mcp/main.ts` (Etapa 5)

Processo stdio com `McpServer` do SDK oficial (validação dos parâmetros com `zod`). Abre o mesmo `data/meter.db` e
chama `ingerir()` **só quando uma ferramenta é chamada** (cada sessão do Claude Code sobe um processo). Erros vão para
`console.error`; nunca `console.log`. Respostas em texto, valores em US$ estimado.

| Ferramenta         | O que devolve                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `consumo_atual`    | 5h, hoje, semana e mês (custo, tokens, mensagens, % do orçamento); horário de renovação da 5h; % do plano se `planoAtivo` |
| `consumo_periodo`  | `de` e `ate` (`AAAA-MM-DD`, `ate` padrão hoje), `agrupar` (`dia`, `sessao`, `projeto`, `modelo`); linhas + total          |
| `status_orcamento` | textos dos alertas ativos, ou "Nenhum alerta" com o limiar                                                                |

## Integrações com o Claude Code `integrations/` (Etapas 6–7)

- **`hook.mjs`** (`UserPromptSubmit`, timeout 2 s): lê só `data/status.json`; se ele tiver menos de 10 min, avisa os
  alertas ainda não vistos (registro em `data/hook-avisados.json`) com `systemMessage` (para o usuário) +
  `hookSpecificOutput.additionalContext` (para o Claude). Sem status ou com erro: silêncio e saída 0.
- **`statusline.mjs`:** recebe o JSON do Claude Code no stdin; grava `data/plano.json` quando a % muda ou a cada 60 s;
  imprime uma linha: badge `[PONYTAIL]`/`[PONYTAIL:ULTRA]` (se existir `~/.claude/.ponytail-active`), `dia X%`,
  `sem X%`, `5h renova HH:MM`, `plano 5h X%`; amarelo com alerta de 80, vermelho com 100. Status com mais de 10 min é
  ignorado; no pior caso imprime só o badge.
- **`integrar.ts`:** mostra o que vai mudar no `settings.json` (de `CLAUDE_CONFIG_DIR` ou `~/.claude`), pede
  confirmação (`--sim` pula), faz backup (`settings.json.bak-mtm-<ms>`), acrescenta o hook (se ainda não houver) e a
  statusline (só se não houver nenhuma) e roda `claude mcp add --scope user my-tokken-meter -- <node> mcp/main.ts`.
  MCP já existente aparece como "já registrado".
- **`desintegrar.ts`:** com confirmação e backup, remove só as entradas cujo comando aponta para `integrations/` deste
  projeto e roda `claude mcp remove --scope user my-tokken-meter`.
- **`comum.ts`:** caminhos (com `/`), comandos com o `node` atual entre aspas, `eDoApp()`, leitura do `settings.json`
  tolerando BOM, backup e `claude()` (via `acharClaude()`, timeout 30 s).

## Arquivos em `data/`

Fora do git (`.gitignore`). Pasta de `pastaDados()` (`MTM_DATA_DIR` nos testes, hook e statusline).

| Arquivo                 | Quem grava                      | Conteúdo                                                 |
| ----------------------- | ------------------------------- | -------------------------------------------------------- |
| `meter.db`              | `core/db.ts` (API e MCP)        | mensagens deduplicadas e offsets dos logs                |
| `config.json`           | `PUT /api/config`               | moeda, unidade, orçamentos, limiar, preços, `planoAtivo` |
| `cambio.json`           | `core/cambio.ts`                | última PTAX                                              |
| `conta.json`            | `POST /api/entrar` e `/sair`    | `email`, `plano`, `metodo`, `entrouEm`, `logado`         |
| `status.json`           | `server/main.ts` (cada leitura) | `geradoEm`, `pct` dos 4 períodos, `alertas`, `renova5h`  |
| `avisados-windows.json` | `server/main.ts`                | ids já mostrados no toast                                |
| `hook-avisados.json`    | `integrations/hook.mjs`         | ids já mostrados na conversa                             |
| `plano.json`            | `integrations/statusline.mjs`   | `cincoH`, `semana`, `renova5h`, `renovaSemana`, `em`     |

## Fluxos

- **Ingestão:** `core/ingest.ts` varre recursivamente os `*.jsonl` de `~/.claude/projects/` (inclui
  `<sessionId>/subagents/agent-*.jsonl`) de forma incremental e grava no SQLite com dedupe por
  `PRIMARY KEY(msg_id, req_id)`. O filtro é só a extensão `.jsonl` (`core/ingest.ts:12`); `tool-results/` não é
  excluída pelo caminho. O histórico sobrevive quando o Claude Code apaga logs antigos (coberto em
  `tests/core.test.ts`).
- **Custo:** calculado na consulta a partir dos tokens (`core/summary.ts`); editar a tabela de preços (padrão mais
  `config.precos`) recalcula o histórico. Modelo pelo nome exato ou pelo maior prefixo; sem preço, os tokens contam, o
  custo não, e o modelo entra em `semPreco` (`custoUsd` é sempre número, não existe `custo=null`).
- **API REST:** rotas e regras em [API REST](#api-rest-servermaints-etapa-3). Escuta só em `127.0.0.1` e recusa
  `Host` e `Origin` desconhecidos.
- **Entrada e saída:** `POST /api/entrar` grava `data/conta.json` com `logado: true`; a partir daí o app abre direto
  no painel (inclusive depois de reiniciar o servidor) até o botão Sair (`POST /api/sair`, `logado: false`).
- **MCP:** só varre quando uma ferramenta é chamada (`consumo_atual`, `consumo_periodo`, `status_orcamento`). Nada de
  `console.log`: o stdout é o canal do protocolo.
- **Alertas:** a cada leitura, o servidor calcula `alertasAtivos()` e grava `data/status.json`. Cada canal registra o
  que já mostrou: toast do Windows (`data/avisados-windows.json`, `filtrarNovos`), hook (`data/hook-avisados.json`),
  banner do navegador (`localStorage`, dispensado pelo usuário). A statusline só pinta a linha conforme o nível. Hook e
  statusline são `.mjs` que só leem arquivos de `data/` (sem banco nem rede) e ficam calados com o app desligado ou
  status com mais de 10 min. A notificação do navegador (`Notification`) prevista na spec **não** foi implementada
  (nenhum uso em `web/src/`).
- **Toast do Windows:** `server/notify-windows.ts` roda `powershell.exe` 5.1 (`-ExecutionPolicy Bypass`, timeout
  10 s) com WinRT; título e texto vão por variável de ambiente (`MTM_TITULO`, `MTM_TEXTO`), nunca concatenados no
  comando. Fora do Windows não faz nada.
- **% do plano:** lida do `rate_limits` (`five_hour`, `seven_day`) que o Claude Code envia ao script da statusline,
  **sem ler o token OAuth**; a statusline grava `data/plano.json` e a API o devolve no `/api/resumo` quando
  `planoAtivo`. Atualiza só com o Claude Code em uso.
- **Renovação:** ver [Sessão, alertas e plano](#sessão-alertas-e-plano-core-etapas-67).
- **Conta:** `core/conta.ts` roda `claude auth status` e usa o JSON (`loggedIn`, `authMethod`, `email`,
  `subscriptionType`, `projectsDirectory`); nunca lê o token. Sem conta, o front mostra `claude auth login`.
- **Câmbio:** `core/cambio.ts` busca a PTAX do Banco Central uma vez por dia e guarda a última cotação em
  `data/cambio.json`; offline, usa a salva. É a **única chamada de rede** do app. Os orçamentos ficam **guardados em
  US$ ou em tokens** (`config.unidade`, `core/config.ts:10`); a moeda escolhida (R$ | US$) é só exibição; a API entrega
  a cotação junto e a conversão é feita no front (`web/src/format.ts`); sem cotação, o front mostra US$ e avisa.
- **Integração:** `npm run integrar`/`desintegrar` fazem backup, pedem confirmação e só mexem nas entradas do app; a
  statusline só é instalada se não houver outra (inclui o badge `[PONYTAIL]`).

## Ambientes

- **Dev:** `npm run dev` (`node server/main.ts --dev --open`) → API + Vite em middleware em
  `http://127.0.0.1:5178` e abre o navegador; `npm run dev:back` (`--watch`, `--dev`, sem abrir o navegador). Porta:
  `MTM_PORTA`.
- **Local sem dev:** `npm run build` (`tsc --noEmit` + `vite build` → `dist/`) e `npm start`
  (`node server/main.ts --open`, serve `dist/`).
- **MCP:** `npm run mcp`, registrado no Claude Code no escopo de usuário por `npm run integrar`.
- **PowerShell do Windows:** com a ExecutionPolicy padrão, `npm` (o `npm.ps1`) é bloqueado; use `npm.cmd run dev` ou
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (README).
- Sem deploy em nuvem. Plataforma principal: Windows 11.
