# Memória: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#11-decisões-tomadas) · [RULES](RULES.md) ·
[ARCHITECTURE](ARCHITECTURE.md) · [TASKS](TASKS.md)

Formato de cada entrada: `aaaa-mm-dd · o que aconteceu · decisão/regra`

## Produto (spec §11)

- 2026-10-31 · definido o que é 100% · os dois: orçamento próprio (base) + % real do plano (módulo opcional e frágil).
- 2026-10-31 · como o Claude consulta · MCP + REST; MCP registrado no escopo de usuário.
- 2026-10-31 · onde avisar aos 80% · banner, notificação, Claude Code e statusline, desde que não atrapalhe o Claude;
  um aviso por período por limiar.
- 2026-10-31 · fonte de dados · só o Claude Code deste PC; claude.ai web e PC da empresa ficam de fora.
- 2026-10-31 · períodos · 5h móvel + dia, semana (segunda) e mês fixos no calendário local.
- 2026-10-31 · visual · claro e escuro, verde + laranja + branco; ícones Lucide.
- 2026-10-31 · cor do limite · 80% laranja, 100% vermelho (`--red` claro `#B91C1C`, escuro `#F87171`) +
  `triangle-alert`.
- 2026-10-31 · telas antes do código · todas em SVG no FigCraft, com portão de aprovação na Etapa 1.
- 2026-10-31 · statusline · a do app, com badge `[PONYTAIL]`, instalada por `npm run integrar` só se não houver outra.
- 2026-10-31 · hook · mostra ao usuário e informa o Claude (`systemMessage` + `additionalContext`), uma vez por
  alerta.
- 2026-10-31 · `/preparar-projeto` · adaptado: virou a Etapa 0.

## Técnico (desenho técnico)

- 2026-10-31 · % do plano · lida do `rate_limits` que o Claude Code envia à statusline, **sem token OAuth**; o
  endpoint OAuth não documentado foi descartado.
- 2026-10-31 · persistência · `node:sqlite` nativo (WAL + `busy_timeout`), dedupe por `PRIMARY KEY(msg_id, req_id)`;
  sem dependências nativas.
- 2026-10-31 · `npm run dev` · Vite em modo middleware na mesma porta do `node:http` (127.0.0.1:5178): sem
  `concurrently`, proxy nem CORS.
- 2026-10-31 · MCP · independente do app: lê os logs pelo `core/` e só varre quando uma ferramenta é chamada.
- 2026-10-31 · lição: duplicatas do streaming · 140 linhas `assistant` = 65 mensagens únicas; sem dedupe o custo
  dobraria.

## Repositório

- 2026-10-31 · repo público `my-tokken-meter` · o e-mail do git neste repo é o `noreply` do GitHub; o
  `check-segredos` barra o e-mail pessoal.
- 2026-10-31 · caminhos pessoais · trocados por `~`; nenhum caminho de usuário do Windows em arquivo commitado.
- 2026-10-31 · `.claude/` · cópia das skills e agentes globais do fluxo dentro do projeto (fora do Prettier); entra no
  escopo de commit `config`.
- 2026-10-31 · licença · MIT; o README cita a ISC do Lucide.
