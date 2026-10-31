# Design: my-tokken-meter

Relacionados: [Spec](specs/2026-10-31-my-tokken-meter.md#tokens-de-cor-aa) · [PRD](PRD.md) · [TASKS](TASKS.md) ·
[MEMORY](MEMORY.md)

> Telas ainda **não desenhadas** (Etapa 1). Nenhum código de interface antes da aprovação do usuário.

## Princípios

- Paleta **verde + laranja + branco**. No escuro, o mesmo verde e laranja, com fundo escuro no lugar do branco.
- **Tema escuro por padrão**, com botão para alternar; a escolha fica salva.
- Ícones **Lucide** (`lucide-react` no front; SVGs de `lucide-static` em `docs/design/icons/`).
- Números em formato brasileiro: US$ com vírgula decimal (não R$).
- Limite: **80% laranja, 100% vermelho** + ícone `triangle-alert`.
- Custo rotulado como "estimado (preço de API)"; os rótulos devem deixar claro que a janela móvel de 5h do orçamento
  não é a janela real da Anthropic.

## Tokens de cor (AA)

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
| `--red` (100%)             | `#B91C1C` | `#F87171` |

`--red` foi acrescentado por decisão do usuário (spec §11, "Cor do limite").

## Telas (Etapa 1)

8 telas × 2 temas = 16 SVGs, mais uma página de componentes. Fonte em `docs/design/my-tokken-meter.figcraft`, SVGs em
`docs/design/svg/`, ícones em `docs/design/icons/`.

| Tela                    | Status     |
| ----------------------- | ---------- |
| Dashboard               | a desenhar |
| Dashboard com alerta    | a desenhar |
| Dashboard sem orçamento | a desenhar |
| Primeiro uso            | a desenhar |
| Vazio                   | a desenhar |
| Erro                    | a desenhar |
| Histórico               | a desenhar |
| Configurações           | a desenhar |
