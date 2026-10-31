---
name: finalizar-commit
description: Fecha a branch de trabalho aberta com /iniciar-commit. Roda os agentes linter e documentador (e o diagramador quando a estrutura mudou), commita no padrão Conventional Commits (skill commit do projeto, se existir), faz merge na branch de origem, apaga a branch e mostra a situação das branches. Use quando o usuário disser "/finalizar-commit", "testei, pode fechar", "encerra a branch".
---

# Finalizar a branch de trabalho

Responda sempre em português. Só rode depois que o usuário disser que testou.

## Passo a passo

1. **Onde estou:** `git branch --show-current`. Normalmente é uma branch de trabalho (`fix/...`, `feat/...` etc.).
   Se estiver numa branch permanente de desenvolvimento (`dev`/`homolog`), é o **modo direto** do `/iniciar-commit`:
   faça os passos 3, 4, 5 e 6 ali mesmo, pule o 7 (só leve para as outras branches se o `CLAUDE.md` mandar) e o 9. Na `main`,
   pare e avise.
   Origem: `git config branch.<branch>.origem`; se não existir, pergunte (normalmente `dev`).
2. **Parar a aplicação de teste** que o `/iniciar-commit` subiu nesta conversa (se ainda estiver rodando).
3. **Linter:** acione o agente `linter` (ferramenta Agent, `subagent_type: linter`) nos arquivos alterados desde a origem
   (`git diff --name-only <origem>...HEAD` + `git status --short`). Mostre o relatório.
   - Se ele apontar algo que não corrigiu sozinho e que pareça bug, **pergunte** se corrige antes de seguir.
   - Se alguma validação falhar, **pare**.
   - Se o linter **alterou conteúdo** de algum arquivo (`git diff --ignore-cr-at-eol --stat`; só fim de linha não conta),
     mostre o resumo do que mudou e **espere o "ok" do usuário** antes de commitar (ele pode querer testar de novo).
     Se não alterou nada, siga direto.
4. **Documentação:** se a tarefa mudou mais do que formatação (código, regra, tela, estrutura), acione o agente
   `documentador` (`subagent_type: documentador`) passando a **origem** e o caminho da **spec** (se houver).
   - Se o relatório dele disser **`DIAGRAMAS: atualizar`**, acione o agente `diagramador`
     (`subagent_type: diagramador`) com o motivo que ele deu.
   - Mostre os relatórios (inclusive **Movido** e **Propostas**). Se algum `.md` mudou, **espere o "ok" do usuário**
     antes de commitar; propostas (regras, remoções) só entram se ele aprovar.
   - Mudança só de formatação ou só de documentação já atualizada: pule este passo e diga por quê.
   - Os `.md` que eles alterarem vão num commit `docs` separado (passo 6).
5. **Spec** (se houver em `docs/specs/` ou na conversa): confira com o usuário os **Critérios de aceite** (lista
   curta: atendido ou não). Algum não atendido: pare e pergunte. Atualize o **Andamento** (fase "concluída", etapas
   marcadas) e inclua a spec no commit. Use Contexto, Problema e Decisões da spec para o corpo da mensagem.
6. **Commitar:** se o projeto tiver a skill `commit`, chame-a (ela separa por assunto). Senão, faça você mesmo:
   um commit por assunto, `git add <arquivos>` (nunca `-A` às cegas), mensagem
   `<tipo>(<escopo>): <descrição no imperativo>` em português, corpo com o porquê e a linha `Co-Authored-By` pedida.
7. **Merge na origem:** `git switch <origem>`, `git pull --ff-only`, `git merge --ff-only <branch>`.
   Se não for fast-forward (a origem andou), faça `git rebase <origem>` na branch de trabalho e tente de novo; em conflito,
   pare e mostre.
   - Se o `CLAUDE.md` do projeto mandar levar para outras branches (ex.: dev → homolog → main), siga o que ele diz.
8. **Push só se o usuário pedir** (pergunte uma vez no fim: "publico na nuvem?").
9. **Apagar a branch de trabalho:** `git branch -d <branch>` (o `-d` só apaga se já estiver no merge; nunca `-D`) e
   `git config --remove-section branch.<branch>` se sobrar. Se ela tiver ido para a nuvem, `git push origin --delete
<branch>` só com o ok do usuário.
10. **Situação final:**

- `git branch -vv` (cada branch, commit e se está à frente/atrás da nuvem);
- `git log --oneline -5`;
- uma linha dizendo em qual branch e commit estamos e o que falta (ex.: "dev 2 commits à frente da nuvem").
