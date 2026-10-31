# PRD: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DESIGN](DESIGN.md) ·
[RULES](RULES.md) · [TASKS](TASKS.md)

Resumo do produto. O detalhe (critérios de aceite, riscos, premissas) está na
[spec](specs/2026-10-31-my-tokken-meter.md).

## Problema

O usuário não sabe quanto já gastou do Claude Code no dia nem na semana até bater no limite do plano. O `/usage` não
tem histórico nem aviso antecipado, e o painel do ponytail mostra custo por conversa, não por dia nem por semana. Ele
quer ser avisado **antes** (quando restarem 20%) e que o próprio Claude consiga consultar o consumo. Ver
[spec §2](specs/2026-10-31-my-tokken-meter.md#2-problema).

## Solução

App **local** (`npm run dev`) que lê os logs do Claude Code em `~/.claude/projects` (somente leitura) e mostra no
navegador o consumo da **janela de 5h, do dia, da semana e do mês**, em US$ estimado e tokens, com % do orçamento
definido pelo usuário e, quando disponível, a **% real do plano** (5h e semana). Alertas aos 80% e 100%, API REST
local e servidor MCP para o Claude responder "quanto já usei hoje?". Ver
[spec §3](specs/2026-10-31-my-tokken-meter.md#3-objetivo-e-resultado-esperado).

## Usuários

O próprio usuário: uso pessoal, no Claude Code **deste PC**. O repositório é público como portfólio.

## Requisitos

Lista completa em [spec §5](specs/2026-10-31-my-tokken-meter.md#5-requisitos). Principais:

- **Um comando:** `npm install` uma vez e `npm run dev` sobe API e front e abre o navegador.
- **Leitura dos logs:** só linhas `type: "assistant"` com `message.usage`; ignorar `model: "<synthetic>"`; dedupe por
  `message.id` + `requestId`; leitura incremental; arquivo apagado mantém o histórico.
- **Custo:** preço por modelo (input, output, escrita de cache 5m/1h, leitura de cache), tabela editável; modelo
  desconhecido aparece como "sem preço" e os tokens contam mesmo assim.
- **Períodos:** janela móvel de 5h, dia, semana (começa na segunda) e mês, no fuso local.
- **Orçamento:** por período (US$ ou tokens), limiar editável com padrão de 80%; sem orçamento, mostra o consumo sem %
  e convida a configurar.
- **% do plano:** opcional, com liga/desliga; se falhar ou estiver desligada, o card mostra "indisponível".
- **Alertas:** banner, notificação do Windows e do navegador, hook do Claude Code e statusline; um aviso por período
  por limiar; hook e statusline nunca atrasam o Claude.
- **MCP:** ferramentas somente leitura (`consumo_atual`, `consumo_periodo`, `status_orcamento`).
- **Telas:** tema claro e escuro (escuro por padrão), paleta verde + laranja + branco, ícones Lucide, números em
  formato brasileiro (US$ com vírgula decimal). Ver [DESIGN](DESIGN.md).

## Fora do escopo

- Conversas do claude.ai no navegador e do app desktop (não há logs locais).
- Logs do PC da empresa (importar depois aumentaria o escopo).
- Login, contas e várias pessoas.
- Deploy na nuvem, app mobile e app desktop empacotado.
- Editar ou apagar os logs do Claude: o app só lê.
