# Design: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#tokens-de-cor-aa) · [PRD](PRD.md) · [TASKS](TASKS.md) ·
[MEMORY](MEMORY.md) · [Telas](design/README.md)

> Telas **aprovadas** pelo usuário em 2026-10-31 (Etapa 1). O código de interface segue esses SVGs. O desenho no
> FigCraft é a **referência**: mudança visual vai primeiro no desenho, é aprovada e só depois entra no código (ver
> [RULES](RULES.md#código)).

## Princípios

- Paleta **verde + laranja + branco**. No escuro, o mesmo verde e laranja, com fundo **neutro (preto)** no lugar do
  branco.
- **Tema escuro por padrão**, com botão para alternar; a escolha fica salva.
- Ícones **Lucide** (`lucide-react` no front; SVGs de `lucide-static` em `docs/design/icons/`).
- Números em formato brasileiro (vírgula decimal), em **R$ ou US$**: seletor no cabeçalho (Dashboard, Dashboard com
  alerta, Sem orçamento, Vazio e Histórico) e moeda padrão no card "Moeda" das Configurações. Cotação automática pela
  PTAX do Banco Central, mostrada com a data (ex.: "PTAX 30/10").
- Limite: **80% laranja** + `triangle-alert`; **100% ou mais vermelho** + `octagon-alert`, inclusive na barra do
  gráfico e na tabela.
- Estado **nunca só pela cor**: sempre há % escrita, ícone ou texto.
- Conta do Claude lida com `claude auth status` (e-mail e plano), sem ler o token.
- Custo rotulado como "estimado (preço de API)"; os rótulos devem deixar claro que a janela móvel de 5h do orçamento
  não é a janela real da Anthropic.
- Valores em `JetBrains Mono`; textos em `IBM Plex Sans` (no front, pacotes `@fontsource` locais, sem rede).

## Tokens de cor (AA)

Variáveis da coleção **Tema** (modos Escuro e Claro) em `docs/design/my-tokken-meter.figcraft`.

| Token                      | Claro           | Escuro          |
| -------------------------- | --------------- | --------------- |
| `--bg`                     | `#FFFFFF`       | `#0A0A0A`       |
| `--surface`                | `#F4F7F5`       | `#141414`       |
| `--surface-2`              | `#E8EEEA`       | `#1F1F1F`       |
| `--border`                 | `#D9E2DC`       | `#2A2A2A`       |
| `--text`                   | `#0F1A14`       | `#FAFAFA`       |
| `--text-muted`             | `#4B5A52`       | `#A1A1A1`       |
| `--green` (preenchimento)  | `#16A34A`       | `#16A34A`       |
| `--orange` (preenchimento) | `#EA580C`       | `#EA580C`       |
| `--red` (100%)             | `#B91C1C`       | `#FF5A5A`       |
| `--green-text`             | `#15803D`       | `#22C55E`       |
| `--orange-text`            | `#C2410C`       | `#FB923C`       |
| `--green-soft`             | `#16A34A` a 10% | `#16A34A` a 15% |
| `--orange-soft`            | `#EA580C` a 10% | `#EA580C` a 15% |
| `--red-soft`               | `#B91C1C` a 10% | `#F87171` a 15% |
| `--on-accent`              | `#FFFFFF`       | `#0A0A0A`       |
| `--accent-btn`             | `#15803D`       | `#22C55E`       |

- `--red` foi acrescentado por decisão do usuário (spec §11, "Cor do limite"). No escuro era `#F87171`; na Etapa 1
  passou a `#FF5A5A` (o `--red-soft` escuro ainda usa `#F87171` a 15%).
- Escuro neutro decidido na Etapa 1 (spec §11, "Modo escuro"); verdes, laranjas e o modo claro não mudaram.
- Contraste conferido no escuro: `--text-muted` 7,1:1 no `--surface`; `--red` 6,0:1 no `--surface`.
- No código, os tokens ficam em `web/src/styles.css` (`[data-theme='escuro']` e `[data-theme='claro']`). Diferença
  conhecida: lá o `--red-soft` escuro é `#FF5A5A` a 15% (`web/src/styles.css:17`), não `#F87171`.

## Telas (Etapa 1)

10 telas × 2 temas = 20 SVGs, desktop 1440 px, com dados fictícios. Lista com os links em
[docs/design/README.md](design/README.md). Fonte em `docs/design/my-tokken-meter.figcraft` (os componentes de ícone
ficam na mesma página), SVGs em `docs/design/svg/`, ícones em `docs/design/icons/`.

| #   | Tela                     | Status   |
| --- | ------------------------ | -------- |
| 00  | Entrar (conta conectada) | aprovada |
| 00  | Entrar (sem conta)       | aprovada |
| 01  | Dashboard                | aprovada |
| 02  | Dashboard com alerta     | aprovada |
| 03  | Dashboard sem orçamento  | aprovada |
| 04  | Primeiro uso             | aprovada |
| 05  | Vazio                    | aprovada |
| 06  | Erro                     | aprovada |
| 07  | Histórico                | aprovada |
| 08  | Configurações            | aprovada |

- **Entrar (conta conectada):** mostra a conta de `claude auth status`. **Sem conta:** mostra o comando
  `claude auth login`.
- **Configurações:** incluem os cards "Conta do Claude" e "Moeda" (moeda padrão).

## Rodapé de renovação nos cards (Etapa 4)

Mudança desenhada no FigCraft depois da Etapa 1 e aprovada pelo usuário: tela 01 (claro e escuro) e
`docs/design/previa-dashboard-escuro.png`. No código: `Renovacao` em `web/src/Sessao.tsx`.

- Os **4 cards** (5h, dia, semana, mês) ganharam, abaixo do rodapé do orçamento, uma faixa com "Renova em 2h 15min"
  (`JetBrains Mono`), o horário ao lado ("às 16:00", "seg, 00:00", "1º nov"), uma barra fina (`--text-muted`) e a % do
  tempo já passado ("40% do dia").
- **5h:** usa o horário oficial que a statusline grava; sem ele, a estimativa pelos logs, com "desde HH:MM" e
  "(estimado)". Sem sessão aberta: "Nenhuma sessão aberta. A próxima começa na sua primeira mensagem." **Dia:**
  meia-noite. **Semana:** segunda seguinte. **Mês:** dia 1º.
- O **card próprio da sessão de 5h** (com gráfico a cada 15 min) foi **removido**; o card **"Plano Claude"** (% real
  da 5h e da semana, "% real · via statusline") fica ao lado do gráfico de 14 dias.
- A barra lateral ganhou o botão **Sair** (ícone `log-out`), acima do seletor de tema.
- Pendente: as telas 02 (com alerta) e 03 (sem orçamento) ainda mostram os cards sem o rodapé ([TASKS](TASKS.md)).
