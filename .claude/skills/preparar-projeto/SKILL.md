---
name: preparar-projeto
description: Prepara qualquer projeto para o fluxo de trabalho do usuário (/pmo → tech-lead → /iniciar-commit → linter → /finalizar-commit). Confere o que falta (CLAUDE.md com branches, como testar, arquivos protegidos e validações; docs/specs; EditorConfig; Prettier e linters) e cria só o que faltar, perguntando o que não der para descobrir. Use quando o usuário disser "/preparar-projeto", "prepara esse projeto", "configura o fluxo aqui", ou quando outra skill do fluxo não achar no CLAUDE.md o que precisa.
---

# Preparar o projeto para o fluxo

Responda sempre em português. Funciona em qualquer projeto. **Não sobrescreva nada que já existe**: complete.
Mostre o diagnóstico antes de criar e peça o ok uma vez só, com a lista do que será criado.

## 1. Diagnóstico (só leitura)

Monte uma tabela "tem / falta" com:

| Item                                     | Como conferir                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Git                                      | `git rev-parse --is-inside-work-tree`; branches (`git branch -a`) e remoto                              |
| CLAUDE.md                                | raiz ou `.claude/CLAUDE.md`                                                                             |
| Seção **Fluxo de trabalho** no CLAUDE.md | branches permanentes, origem padrão, propagação (ex.: dev → homolog → main)                             |
| **Como testar localmente**               | comando e URL/porta                                                                                     |
| **Validações**                           | build, testes, selfchecks                                                                               |
| **Arquivos protegidos**                  | gerados, dados, vendor, o que formatador/linter não pode tocar                                          |
| `docs/specs/`                            | pasta das specs                                                                                         |
| `docs/` principais                       | `PRD`, `ARCHITECTURE`, `RULES`, `DESIGN`, `MEMORY`, `TASKS` (.md) e diagrama Mermaid no README          |
| `.editorconfig`                          | raiz                                                                                                    |
| Formatação/lint                          | Prettier (`.prettierrc`, `.prettierignore`), ESLint, Stylelint, Ruff, conforme as linguagens do projeto |
| Skill `commit`                           | a global (`~/.claude/skills/commit`) vale para todos; a do projeto (`.claude/skills/commit`) é opcional |
| **Escopos de commit** no CLAUDE.md       | lista `escopo → pastas/arquivos`, usada pela skill `commit`                                             |

## 2. Descobrir sozinho antes de perguntar

- Linguagens: extensões dos arquivos versionados (`git ls-files`).
- Como testar: `package.json` (scripts `dev`/`start`), `run.py`, `manage.py`, `docker-compose*.yml`, `Makefile`, README.
- Validações: scripts `test`/`lint`/`build`, pasta `tests/`, selfchecks.
- Protegidos: `.gitignore`, pastas `dist/`, `build/`, `vendor/`, `data/`, arquivos gerados citados no README.
- Branches: as que existem; se só houver `main`, proponha criar `dev` (só com ok).

## 3. Perguntar só o que faltou

AskUserQuestion, com opções e a recomendação em primeiro. Típico: branches permanentes e propagação, comando de teste,
o que não pode ser tocado. No máximo 4 perguntas.

## 4. Criar o que falta (com o ok do usuário)

- **CLAUDE.md:** se não existir, crie `.claude/CLAUDE.md` com um resumo do projeto (o que é, estrutura, idioma) e a seção
  abaixo. Se existir, **acrescente** só a seção que falta.

```
## Fluxo de trabalho
- Branches permanentes: ... Origem padrão das tarefas: ... Depois do merge, levar para: ...
- Branch de trabalho: `<tipo>/<palavras-chave>` (tipos do Conventional Commits). Mudança pequena vai direto na origem.
- Planejamento: `/pmo` → spec em `docs/specs/<aaaa-mm-dd>-<assunto>.md` → agente `tech-lead`.
- Execução: `/iniciar-commit` → trabalho e teste do usuário → `/finalizar-commit` (agentes `linter` e `documentador`,
  `diagramador` se a estrutura mudou, commit, merge).
- Documentação: `docs/` (PRD, ARCHITECTURE, RULES, DESIGN, MEMORY, TASKS, specs), mantida pelo `documentador`.
- Commits: Conventional Commits em português; só commitar ou publicar quando o usuário pedir.

### Como testar localmente
<comando> → <url>

### Validações
<comandos>

### Não tocar (formatador, linter e agentes)
<lista>

### Escopos de commit
| Escopo | Pastas/arquivos |
| --- | --- |
| <escopo> | <pastas> |
```

- **Escopos:** proponha a lista a partir das pastas principais do projeto (`git ls-files` agrupado pela primeira pasta;
  inclua `docs` e `config`) e confirme com o usuário na mesma pergunta do ok.

- **`docs/specs/`:** crie com um `README.md` de uma linha ("Specs das tarefas, geradas pelo /pmo.").
- **`docs/` principais** (só os que faltam): esqueleto com título, linha "Relacionados" e as seções, preenchendo o que
  já der para descobrir (README, código, CLAUDE.md):
  - `PRD.md` (problema, solução, usuários, requisitos, fora do escopo); `ARCHITECTURE.md` (visão geral, componentes,
    fluxos, ambientes); `RULES.md` (dados, git, código); `DESIGN.md` (só se houver interface);
  - `MEMORY.md` com a linha de formato `aaaa-mm-dd · o que aconteceu · decisão/regra`; `TASKS.md` com "Em aberto" e
    "Concluídas".
  - Depois, acione o agente **`diagramador`** para o primeiro desenho (README "Como funciona"/"Arquitetura" e
    `ARCHITECTURE.md`) e recomende a extensão `bierner.markdown-mermaid` em `.vscode/extensions.json`.
- **`.editorconfig`:** UTF-8, LF, quebra de linha final, sem espaço no fim; 4 espaços em `.py`, 2 nos demais.
- **Linters:** só para as linguagens que o projeto usa, e só com ok explícito (instalar dependência mexe no projeto):
  - JS/CSS/HTML/MD: Prettier (`.prettierrc` com `"endOfLine": "auto"`, `.prettierignore` com os protegidos) e, se houver
    JS/CSS, ESLint (`eslint.config.js` com `js.configs.recommended`) e Stylelint (`stylelint-config-standard`), como
    `devDependencies` e scripts `format`, `format:check`, `lint`.
  - Python: Ruff na venv do projeto, com `[tool.ruff]` no `pyproject.toml` (ou `ruff.toml`) e `exclude` dos protegidos.
  - Depois de configurar, rode em modo **só checagem** e mostre o resultado; **não** corrija o projeto inteiro sem pedir.
- Se o projeto ainda não tiver git, pergunte antes de rodar `git init`.

## 5. Fechar

- Rode as validações descobertas para garantir que nada quebrou.
- Resumo: o que foi criado, o que já existia, o que ficou pendente.
- Sugira commitar direto na origem: `chore(config): prepara o projeto para o fluxo de trabalho` (via `/finalizar-commit`).

## Nunca

- Sobrescrever arquivos de configuração existentes, reformatar o projeto todo ou instalar algo sem ok.
- Inventar comando de teste: se não achou e o usuário não souber, deixe "a definir" no CLAUDE.md.
