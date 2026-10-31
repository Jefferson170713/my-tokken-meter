---
name: iniciar-commit
description: Abre uma branch de trabalho nova (fix/..., feat/..., etc.) a partir da branch atual (dev ou homolog), atualizada com a nuvem, e sobe a aplicação para o usuário testar. Use quando o usuário disser "/iniciar-commit", "abre uma branch", "vamos começar uma correção/funcionalidade nova".
---

# Iniciar trabalho numa branch nova

Responda sempre em português. Esta skill vale para qualquer projeto: o que é específico (comando de teste, branches
permanentes) vem do `CLAUDE.md` do projeto.

## Branch ou direto?

Decida antes de tudo, sem gastar pergunta quando der para decidir sozinho:

- O usuário escreveu **`direto`** ou **`branch`** nos argumentos: obedeça.
- **Direto** (sem branch, sem subir a aplicação): mudança pequena que não altera o comportamento da aplicação: só
  documentação, comentários, configuração do editor/Claude, ou ajuste de 1 arquivo com poucas linhas.
  Diga em uma linha: "Mudança pequena: vou trabalhar direto na `<origem>`." e siga só os passos 2 e 3. No fim, o
  `/finalizar-commit` commita na própria origem.
- **Branch**: qualquer mudança no código da aplicação, no BI, em dependências, ou em vários arquivos.
- Na dúvida, uma pergunta curta: "Abro branch ou faço direto na `<origem>`?"

## Passo a passo

1. **Ler o projeto:** procure no `CLAUDE.md` (raiz ou `.claude/`) as seções de branches e de "como testar localmente".
   Se faltar o fluxo de trabalho ou o comando de teste, sugira rodar `/preparar-projeto` antes (ou, se o usuário
   preferir seguir, pergunte só o comando de teste).
2. **Onde estou:** `git branch --show-current` e `git status --short`.
   - A origem tem que ser uma branch permanente de desenvolvimento (`dev` ou `homolog`, ou as que o `CLAUDE.md` disser).
     Se estiver na `main`, ou numa branch de trabalho, **pergunte** de onde sair.
   - Se houver mudanças sem commit, **pare e pergunte**: levar para a branch nova, guardar (`git stash`) ou commitar antes.
3. **Atualizar a origem:** `git fetch` e `git pull --ff-only`. Se não for fast-forward, mostre e pergunte; nunca force.
4. **Nome da branch:** `<tipo>/<palavras-chave>`, no padrão do mercado.
   - Tipos (os mesmos do Conventional Commits): `feat`, `fix`, `refactor`, `docs`, `style`, `perf`, `test`, `chore`.
   - Palavras-chave: 2 a 4, minúsculas, sem acento, separadas por hífen. Ex.: `fix/slide-status-quebra`,
     `feat/filtro-decisao`.
   - Escolha o tipo pelo pedido; se estiver em dúvida entre dois, pergunte.
5. **Criar:** `git switch -c <tipo>/<palavras>`. Guarde a origem para o `/finalizar-commit`:
   `git config branch.<tipo>/<palavras>.origem <origem>`.
6. **Subir a aplicação** com o comando do `CLAUDE.md`, em segundo plano (`run_in_background`), e confirme que respondeu
   (ex.: `curl -s -o /dev/null -w "%{http_code}" <url>`). Se a porta estiver ocupada, avise em vez de matar processo.
7. **Spec:** se houver uma spec da tarefa (`docs/specs/`, a mais recente sobre o assunto), leia **só o bloco
   Andamento** e atualize: fase "implementação", branch, agora e próximo. Durante o trabalho, marque `[x]` em cada
   etapa concluída e mantenha "Agora/Próximo" em dia. Abra o resto da spec só quando precisar de um detalhe.
8. **Resumo curto:** branch criada, origem, commit de partida (`git log --oneline -1`), URL de teste e o lembrete:
   "quando terminar de testar, use /finalizar-commit".

## Nunca

- Não crie branch com o nome de uma branch permanente nem como `dev/...` (o git recusa quando existe a branch `dev`).
- Não faça push da branch de trabalho, a não ser que o usuário peça.
- Não apague nem descarte mudanças do usuário.
