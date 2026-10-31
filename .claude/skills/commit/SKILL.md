---
name: commit
description: Separa as mudanças em commits por assunto e commita no padrão Conventional Commits em português, em qualquer projeto. Use quando o usuário pedir "commita", "salva no git", "faz o commit", "/commit", ou quando o /finalizar-commit chamar. Se o projeto tiver a própria skill commit (.claude/skills/commit), ela tem prioridade.
---

# Commit no padrão Conventional Commits (universal)

Responda em português. Use o contexto da conversa (e a spec, se houver) para explicar o **porquê**, não só o diff.

## Passo a passo

1. **Onde estou:** `git branch --show-current` e `git status --short`. Na `main` (ou branch de produção), **pare e
   pergunte**.
2. **Regras do projeto:** leia o `CLAUDE.md` (raiz ou `.claude/`): escopos, arquivos que não podem entrar, validações.
3. **Formatar e validar:** se o projeto tiver script de formatação (`npm run format`) ou as validações do `CLAUDE.md`,
   rode. Falhou: **não commite**, mostre o erro.
4. **Separar por assunto:** leia `git diff` e agrupe por mudança lógica. `git add <arquivos>` por grupo; **nunca**
   `git add -A` às cegas.
5. **Conferir:** `git diff --cached --stat` antes de cada commit. Nada de dados, segredos ou gerados (veja "Nunca").
6. **Commitar** cada grupo (heredoc para várias linhas).
7. **Push só se o usuário pedir.**
8. **Resumo:** `git log --oneline -n <N>`, uma linha por commit.

## Formato

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final>

<corpo: o porquê e o que muda para quem usa, linhas de até 100 caracteres>

Co-Authored-By: <a linha de atribuição pedida pelo ambiente>
```

- Descrição com até ~72 caracteres, verbo no imperativo ("adiciona", "corrige", "mostra").
- Quebra compatibilidade: `tipo(escopo)!:` e rodapé `BREAKING CHANGE: <o que muda e o que fazer>`.

| Tipo       | Quando                                                           |
| ---------- | ---------------------------------------------------------------- |
| `feat`     | Funcionalidade nova para quem usa                                |
| `fix`      | Correção de erro ou de regra                                     |
| `docs`     | Só documentação                                                  |
| `style`    | Só formatação, sem mudar comportamento                           |
| `refactor` | Reorganiza sem mudar comportamento                               |
| `perf`     | Desempenho                                                       |
| `test`     | Testes                                                           |
| `build`    | Dependências, Docker, empacotamento                              |
| `ci`       | Pipeline                                                         |
| `chore`    | Configuração e manutenção (`.claude/`, `.vscode/`, `.gitignore`) |
| `revert`   | Desfaz commit                                                    |

**Escopo:** use a lista do `CLAUDE.md` (seção "Escopos de commit"), se houver. Senão, use a pasta ou a área principal
tocada (ex.: `api`, `front`, `docs`, `config`), curto e minúsculo. Mudança em várias áreas: omita o escopo. Se o
projeto não tiver a lista, sugira ao usuário incluí-la no `CLAUDE.md` (o `/preparar-projeto` faz isso).

## Nunca

- Commitar dados, `.env`, chaves, planilhas, bancos, arquivos gerados ou o que o `CLAUDE.md` proibir. Se aparecerem,
  avise e não adicione.
- `--no-verify`, `--amend` em commit já enviado, `push --force` ou push sem pedido.
- Misturar assuntos num commit só.
