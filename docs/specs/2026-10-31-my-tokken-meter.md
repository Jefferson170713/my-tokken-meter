# Spec: my-tokken-meter — medidor local de consumo do Claude Code

## Andamento

- **Fase:** implementação (Etapa 0 concluída)
- **Branch:** direto na `main` até a Etapa 0 criar a `dev`; depois, uma branch por etapa (nomes no Desenho técnico)
- **Agora:** Etapa 0 concluída: configs, docs, `check-segredos`, repo público e branch `dev`
- **Próximo:** Etapa 1, telas no FigCraft (branch `docs/telas-svg-figcraft` a partir da `dev`)
- **Etapas:**
  - [x] 0. Preparar o projeto: `.gitignore` (crítico), configs, `CLAUDE.md`, `check-segredos`, repo público, `dev`
  - [ ] 1. Telas: tokens + componentes + 8 telas × 2 temas no FigCraft, SVGs e ícones → **aprovação do usuário**
  - [ ] 2. `core/`: parser, ingest incremental, SQLite, períodos, preços (com testes `node:test`)
  - [ ] 3. API REST em `node:http` (127.0.0.1:5178, checagem de Host)
  - [ ] 4. Front: Vite em middleware, `npm run dev` abre o navegador; dashboard, histórico, configurações, tema
  - [ ] 5. Servidor MCP (stdio, SDK oficial, independente do app)
  - [ ] 6. Alertas: motor, toast do Windows, banner, `Notification`, hook, statusline, `integrar`/`desintegrar`
  - [ ] 7. % do plano pelo `rate_limits` da statusline
  - [ ] 8. README, diagramas, `check-segredos` e publicação

## Plano: my-tokken-meter

### 1. Contexto

- Pasta `~/Desktop/Projetos/consumo-tokens`, hoje **vazia** (sem git, sem `CLAUDE.md`).
- Repositório novo e **público** no GitHub: `Jefferson170713/my-tokken-meter`. A pasta local mantém o nome `consumo-tokens`.
- O Claude Code grava cada resposta em `~/.claude/projects/<projeto>/<sessão>.jsonl`. As linhas `type: "assistant"`
  trazem `message.model` e `message.usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`, com `cache_creation.ephemeral_5m/1h`). Essa é a fonte de dados.
- O plugin ponytail já grava custo por tarefa em `~/.config/ponytail/band/*.csv`. Serve de referência para conferir os
  números, mas **não** é a fonte (só existe com o plugin ativo).
- O usuário trabalha com o fluxo `/pmo` → `tech-lead` → `/iniciar-commit` → `/finalizar-commit` e quer as telas
  aprovadas **antes** de qualquer código.

### 2. Problema

O usuário não sabe quanto já gastou do Claude no dia nem na semana até bater no limite do plano. Hoje só existe o
`/usage` (sem histórico nem aviso antecipado) e o painel do ponytail (custo por conversa, não por dia nem por semana).
Ele quer saber **antes** que está perto do limite: ser avisado quando restarem 20% e o próprio Claude conseguir
consultar o consumo.

### 3. Objetivo e resultado esperado

- `npm run dev` sobe tudo, e o navegador mostra o consumo da **janela de 5h, do dia, da semana e do mês**.
- Cada período mostra os gastos em US$ estimado e em tokens, com % do orçamento que o usuário definiu.
- Também mostra a **% real do plano** (5h e semana), quando a Anthropic informar.
- Aos **80% usados** (20% restantes), o usuário é avisado em quatro lugares: banner, notificação do Windows,
  dentro do Claude Code e statusline. Cada aviso aparece uma vez por período, sem repetir a cada mensagem.
- O Claude, em qualquer projeto, responde "quanto já usei hoje?" chamando a ferramenta MCP do app.

### 4. Escopo

**Entra:**

- Leitura incremental dos `.jsonl` de `~/.claude/projects` (inclui subagentes), sem duplicar mensagens.
- Cálculo de custo por modelo com tabela de preços editável.
- Períodos: janela móvel de 5h, dia, semana (começa na segunda) e mês, no fuso local.
- Orçamentos por período definidos pelo usuário (US$ ou tokens), com limiar padrão de 80%.
- % real do plano (janela de 5h e semana), opcional e com liga/desliga.
- Telas: dashboard, histórico (por dia, sessão, projeto e modelo), configurações, primeiro uso e estados de vazio,
  erro e alerta, em **tema claro e escuro**.
- API REST local, servidor MCP (stdio) e registro no Claude Code no escopo de usuário.
- Alertas: banner, notificação do Windows e do navegador, hook do Claude Code e statusline.
- Ícones **Lucide** (SVG baixados para o projeto e o pacote para o front).
- Etapa 0 de preparação: git, repo público, `CLAUDE.md`, `docs/`, EditorConfig e linters.

**Fica de fora:**

- Conversas do claude.ai no navegador e do app desktop, porque não há logs locais delas.
- Logs do PC da empresa. É possível importar depois, mas aumenta o escopo.
- Login, contas e várias pessoas, porque o app é pessoal e local.
- Deploy na nuvem, porque o app roda local.
- App mobile e app desktop empacotado: o navegador basta.
- Editar ou apagar os logs do Claude: o app só lê.

### 5. Requisitos

- **Um comando:** `npm install` uma vez e depois `npm run dev`, que sobe a API e o front e abre o navegador.
- **Leitura dos logs:**
  - Considerar só as linhas `type: "assistant"` com `message.usage`.
  - Ignorar `model: "<synthetic>"`.
  - Remover duplicatas por `message.id` + `requestId`, porque o streaming grava a mesma mensagem mais de uma vez.
  - Arquivo novo ou que cresceu entra sem reler tudo; arquivo apagado mantém o histórico já calculado.
- **Custo:**
  - Preço por modelo para input, output, escrita de cache (5m/1h) e leitura de cache.
  - Modelo desconhecido entra como "sem preço", aparece em destaque na tela e conta os tokens mesmo assim.
- **Orçamento:**
  - Sem orçamento definido, a tela mostra o consumo sem % e convida a configurar.
  - O limiar é editável; o padrão é 80%.
- **% do plano:**
  - Se a consulta falhar ou estiver desligada, o card mostra "indisponível". Nada mais quebra.
- **Alertas:**
  - Um aviso por período por limiar (ex.: dia 80%, depois dia 100%), registrado para não repetir.
  - O hook e a statusline nunca atrasam o Claude: timeout curto e silêncio se o app estiver desligado.
- **MCP:** ferramentas somente leitura, por exemplo `consumo_atual` (todos os períodos), `consumo_periodo` (de/até,
  agrupado) e `status_orcamento`.
- **Telas:**
  - Paleta **verde + laranja + branco**. No escuro, o mesmo verde e laranja, com fundo escuro no lugar do branco.
  - Tema escuro por padrão, com botão para alternar.
  - Ícones Lucide.
  - Números com formato brasileiro (R$ não; US$ com vírgula decimal).

### 6. Restrições e regras que não podem quebrar

- **Repo público:** nunca commitar logs, `.credentials.json`, dados de uso, configurações pessoais ou caminhos com
  dados. `.gitignore` desde o primeiro commit. Os exemplos usam dados fictícios.
- **Credenciais:** a % do plano precisa do token OAuth do Claude Code. Ele é lido só na hora, nunca é gravado, logado
  ou enviado a outro lugar que não seja a Anthropic.
- **Somente leitura** em `~/.claude`. As únicas escritas fora do projeto são o registro do MCP, o hook e a statusline,
  feitos com ok do usuário e com um comando para desfazer.
- **Não atrapalhar o Claude:** hook e statusline precisam ser rápidos (< 300 ms) e tolerar o app desligado.
- **Convivência com o ponytail:** ele já usa hooks e a faixa de cima do painel. Não sobrescrever a configuração dele.
- **Fluxo do usuário:** commits só com pedido, Conventional Commits em português, telas aprovadas antes do código.
- **Local:** a API escuta só em `127.0.0.1`.

### 7. Riscos

| Risco                                                 | Consequência                | Como evitar ou detectar                                                                        |
| ----------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| A % do plano depende de endpoint **não documentado**  | Para de funcionar sem aviso | Isolado num módulo, com liga/desliga e "indisponível" na tela; o resto do app não depende dele |
| O formato do `.jsonl` muda numa versão do Claude Code | Números errados ou zerados  | Parser tolerante, testes com amostras reais anonimizadas e aviso de "linhas ignoradas" na tela |
| Duplicatas do streaming                               | Custo inflado               | Dedupe por `message.id` + `requestId`, com teste                                               |
| Preços mudam                                          | Custo estimado errado       | Tabela editável e data da tabela visível nas configurações                                     |
| Custo estimado ≠ cobrança real                        | Usuário acha que pagou isso | Rotular como "estimado (preço de API)"; no plano Pro/Max não é cobrança                        |
| Hook ou statusline lentos                             | Claude fica lento           | Timeout curto, cache da última resposta e teste de tempo                                       |
| Conflito com ponytail ou ECC (hooks, statusline)      | Um desliga o outro          | Adicionar sem sobrescrever; conferir `settings.json` antes e depois                            |
| Vazamento no repo público                             | Dados ou token expostos     | `.gitignore`, varredura de segredos antes de cada push, fixtures fictícias                     |
| Notificação do navegador exige aba aberta             | Aviso não chega             | Notificação do Windows enviada pelo servidor, independente da aba                              |
| Ferramentas do FigCraft não carregadas nesta sessão   | Telas atrasam               | Reabrir o VS Code com o app aberto pelo atalho "FigCraft (Claude)" antes da Etapa 1            |

### 8. Premissas

- Só o Claude Code **deste PC** é medido.
- A semana começa na segunda às 00:00, no horário local. O dia vai de 00:00 a 23:59.
- O custo é estimado com preços públicos da API e serve como referência, não como fatura.
- Node 26 já instalado e Windows 11 como plataforma principal.
- O tech lead escolhe a stack. Sugestão: Node + TypeScript, Vite + React no front e um servidor leve no back.
- A Etapa 0 substitui o `/preparar-projeto` neste projeto vazio, com o mesmo resultado.

### 9. Critérios de aceite

- Dado o projeto clonado, quando rodo `npm install` e `npm run dev`, então o dashboard abre no navegador sem outro
  comando.
- Dado um dia com uso, quando abro o dashboard, então vejo 5h, dia, semana e mês com US$ estimado, tokens e % do
  orçamento. O total do dia bate com a soma das mensagens daquele dia nos `.jsonl`, com margem de 1%.
- Dado o mesmo log lido duas vezes, quando recalculo, então o total não muda (sem duplicar).
- Dado um orçamento diário definido, quando o uso passa de 80%, então aparecem uma vez cada: banner, notificação do
  Windows, aviso no Claude Code e statusline em destaque.
- Dado o app desligado, quando uso o Claude Code, então nada fica mais lento e nenhum erro aparece.
- Dado o MCP registrado, quando pergunto ao Claude "quanto já usei hoje?", então ele responde com os números do app.
- Dado o % do plano desligado ou falhando, quando abro o dashboard, então o card mostra "indisponível" e o resto
  funciona.
- Dado o tema escuro, quando clico no botão, então o app muda para o claro, e a escolha fica salva.
- Dado o repositório público, quando confiro os arquivos, então não há log, token ou dado pessoal.
- As telas em SVG (claro e escuro) foram aprovadas pelo usuário antes da Etapa 2.

### 10. Como testar

1. `npm install` e `npm run dev`, depois conferir se o navegador abre o dashboard.
2. Comparar o total de hoje com o painel do ponytail ou o `/usage`. A ordem de grandeza deve bater.
3. Em configurações, pôr um orçamento diário baixo (ex.: US$ 1) e ver os quatro alertas.
4. No Claude Code, perguntar "quanto já usei hoje?".
5. Desligar o app e usar o Claude Code normalmente: não deve haver lentidão.
6. Alternar o tema; recarregar e conferir se a escolha ficou salva.
7. Automático: testes do parser (dedupe, synthetic, períodos, fuso, custo), `npm run lint` e `npm run build`.

### 11. Decisões tomadas

| Pergunta                | Resposta                                                                                     | O que implica                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| O que é 100% do dia?    | **Os dois:** orçamento próprio + % real do plano                                             | Orçamento é a base; % do plano é módulo opcional e frágil          |
| Como o Claude consulta? | **MCP + REST**                                                                               | Servidor MCP no projeto, registrado no escopo de usuário           |
| Onde avisar aos 20%?    | **Todos:** banner, notificação, Claude Code, statusline — "desde que não atrapalhe o Claude" | Hook e statusline com timeout curto e um aviso por período         |
| Fonte de dados          | **Claude Code deste PC**                                                                     | claude.ai web e PC da empresa ficam de fora                        |
| Períodos                | **5h + dia + semana + mês**                                                                  | Janela de 5h móvel; dia, semana e mês fixos no calendário local    |
| Ícones                  | **Lucide**                                                                                   | SVGs no projeto + `lucide-react`                                   |
| Visual                  | **Claro e escuro**, verde + laranja + branco; no escuro troca só o branco                    | Duas versões de cada tela                                          |
| `/preparar-projeto`     | **Adaptar a este projeto**                                                                   | Vira a Etapa 0, depois da aprovação                                |
| Telas antes do código   | Todas em SVG, desenhadas no FigCraft com as skills de design                                 | Etapa 1 com portão de aprovação                                    |
| Repositório             | Público, `my-tokken-meter`                                                                   | Cuidado redobrado com segredos e dados                             |
| % do plano              | **Pela statusline** (`rate_limits`), sem token                                               | Endpoint OAuth descartado; atualiza só com o Claude Code em uso    |
| Statusline              | **A do app**, com badge `[PONYTAIL]`                                                         | Instalada por `npm run integrar` só se não houver outra            |
| Hook                    | **Mostra ao usuário e informa o Claude**                                                     | `systemMessage` + `additionalContext`, uma vez por alerta          |
| Cor do limite           | **80% laranja, 100% vermelho** + ícone `triangle-alert`                                      | Acrescentar `--red` (claro `#B91C1C`, escuro `#F87171`) aos tokens |
| Caminhos pessoais       | **Trocados por `~`**                                                                         | Nenhum caminho de usuário do Windows em arquivo commitado          |
| Licença                 | **MIT**                                                                                      | `LICENSE` na Etapa 0; README cita a ISC do Lucide                  |

**Tamanho:** grande — **Público:** o próprio usuário (uso pessoal, repo público como portfólio)

## Desenho técnico

Resumo do tech lead (2026-10-31).

### Abordagem

- **Um processo Node 26 com TypeScript nativo**, sem build no back-end. O tsconfig usa `erasableSyntaxOnly`: sem
  `enum` e sem `namespace`.
- **Servidor:** `node:http`, com roteador pequeno (~6 rotas). Express, Hono e Fastify foram descartados.
- **`npm run dev`:** monta o **Vite em modo middleware** na mesma porta (127.0.0.1:5178) e abre o navegador. Não
  precisa de `concurrently`, proxy nem CORS.
- **Persistência:** `node:sqlite` nativo em `data/meter.db` (WAL + `busy_timeout`). O dedupe é feito por
  `PRIMARY KEY(msg_id, req_id)`. O SQLite guarda o histórico mesmo quando o Claude Code apaga logs antigos (30 dias).
- **Núcleo `core/`:** compartilhado por API, MCP e testes.
- **Hook e statusline:** `.mjs` mínimos que só leem `data/status.json`, gravado pelo servidor. Ficam abaixo de 300 ms
  e não fazem nada se o app estiver desligado.
- **Sem dependências nativas:** `better-sqlite3` e `node-notifier` foram descartados.

### Achados no ambiente

- **Subagentes:** gravam em `<sessionId>/subagents/agent-*.jsonl` e entram na conta. Ignorar `tool-results/`.
- **Duplicatas confirmadas:** 140 linhas `assistant` correspondem a 65 mensagens únicas. Sem dedupe, o custo
  dobraria.
- **Linhas a ignorar:** `api-request*` trazem o prompt inteiro e nunca podem ser copiadas. `cost-state` tem
  `totalCostUSD: 0` e não serve como fonte.
- **% do plano sem token:** o Claude Code 2.1.314 já envia `rate_limits.five_hour.used_percentage`, `resets_at` e
  `seven_day.used_percentage` para o script da statusline. Esse é o caminho A, que não exige ler o token OAuth.
- **Ponytail:** não tem tabela de preços (o custo dele vem do `/cost`). Se não houver `statusLine`, ele pede para
  instalar a dele, que só mostra o badge `[PONYTAIL]`.

### Estrutura

`core/` (paths, db, parser, ingest, prices + `prices.default.json`, periods, summary, config, alerts, status-file,
plan) · `server/` (main, notify-windows) · `mcp/main.ts` · `integrations/` (hook.mjs, statusline.mjs, integrar,
desintegrar) · `scripts/check-segredos.mjs` · `web/` (React: Dashboard, Historico, Configuracoes, PrimeiroUso +
componentes) · `tests/` (`node:test` + fixtures fictícias) · `docs/design/` · `data/` (ignorada pelo git).

### Pontos-chave

- **Custo:** calculado na consulta, a partir dos tokens. Editar a tabela de preços recalcula todo o histórico. O
  modelo é encontrado pelo nome exato ou pelo maior prefixo; modelo sem preço gera `custo=null` e os tokens contam
  mesmo assim.
- **Períodos:** janela de 5h móvel; dia, semana (segunda) e mês em hora local. Testes com `TZ` fixo.
- **API:**
  - Rotas `GET /api/resumo`, `/historico`, `/config` (+`PUT`), `/plano`, `/status` e `/health`.
  - A API recusa `Host` desconhecido, para evitar DNS rebinding.
- **MCP:**
  - Independente do app (lê os logs pelo `core/`) e só varre quando uma ferramenta é chamada.
  - Ferramentas: `consumo_atual`, `consumo_periodo` e `status_orcamento`.
  - Nada de `console.log`, porque o stdout é o canal do protocolo.
- **Alertas:**
  - Cada alerta tem um id `periodo:chave:limiar`, e cada canal registra o que já mostrou.
  - **Toast:** `powershell.exe` 5.1 via WinRT, com os textos passados por variável de ambiente.
  - **Hook:** `UserPromptSubmit`, com timeout de 2 s.
  - **Statusline:** só é instalada se não houver outra, e já inclui o badge do ponytail.
  - **`npm run integrar` / `desintegrar`:** fazem backup, pedem confirmação e só mexem nas entradas do app.
- **Testes:**
  - **Dedupe:** linhas repetidas contam uma vez.
  - **Logs:** `<synthetic>` é ignorado, linhas quebradas são contadas, a leitura é incremental e retoma linhas
    parciais, e o histórico sobrevive a arquivos apagados.
  - **Períodos e preços:** viradas de semana e de mês, horário de verão, busca por prefixo e modelo sem preço.
  - **Alertas e hook:** os alertas não se repetem; o hook roda em menos de 300 ms.
- **Etapa 1:**
  - 8 telas × 2 temas = 16 SVGs: dashboard, dashboard com alerta, dashboard sem orçamento, primeiro uso, vazio, erro,
    histórico e configurações.
  - Uma página extra de componentes.
  - Arquivos: fonte em `docs/design/my-tokken-meter.figcraft`, SVGs em `docs/design/svg/` e ícones Lucide (de
    `lucide-static`) em `docs/design/icons/`.
  - Skills: `ui-ux-pro-max` (layout), `ecc:design-system` (tokens) e `ecc:taste` (revisão).

### Tokens de cor (AA)

| Token                      | Claro     | Escuro    |
| -------------------------- | --------- | --------- |
| `--bg`                     | `#FFFFFF` | `#0F1512` |
| `--surface`                | `#F4F7F5` | `#18211C` |
| `--text`                   | `#0F1A14` | `#F1F5F3` |
| `--text-muted`             | `#4B5A52` | `#A3B1AA` |
| `--green` (preenchimento)  | `#16A34A` | `#16A34A` |
| `--orange` (preenchimento) | `#EA580C` | `#EA580C` |
| `--green-text`             | `#15803D` | `#22C55E` |
| `--orange-text`            | `#C2410C` | `#FB923C` |

### Branches

Etapa 0 direto na `main`. Depois, a partir da `dev`: `docs/telas-svg-figcraft`, `feat/leitor-logs-consumo`,
`feat/api-rest-local`, `feat/front-dashboard`, `feat/servidor-mcp`, `feat/alertas-hook-statusline`,
`feat/percentual-plano` e `docs/readme-publicacao`.

### Riscos novos

- **A janela móvel de 5h do orçamento ≠ a janela real da Anthropic**, que começa no primeiro uso e tem `resets_at`.
  Os rótulos precisam deixar isso claro.
- **`iterations[]`/`advisorModel` e `speed` (fast mode):** podem alterar a conta. Exibir contadores para conferir.
- **Toast:** o modo Foco/Não incomodar do Windows pode esconder a notificação. O banner e o hook cobrem esse caso.
