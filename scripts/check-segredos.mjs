// Varre os arquivos versionados atrás de segredos e dados pessoais antes de publicar (o repo é público).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const arquivos = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean)
const proprio = 'scripts/check-segredos.mjs'

const padroes = [
  ['token da Anthropic', /sk-ant-[\w-]{10,}/],
  ['token OAuth', /"(accessToken|refreshToken)"\s*:/],
  ['cabeçalho Bearer com valor', /Bearer\s+[\w.-]{20,}/],
  ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ['caminho de usuário do Windows', /[A-Za-z]:[\\/]+Users[\\/]+(?!<|\.\.\.|exemplo)[\w.-]+/i],
  ['caminho de usuário do Git Bash', /\/c\/Users\/(?!<|exemplo)[\w.-]+/i],
  ['id real de mensagem/requisição', /\b(msg|req)_01[A-Za-z0-9]{10,}/],
]

// e-mails do próprio usuário vêm do git (o global também, o do repo pode ser o noreply), para não gravá-los aqui
const emails = new Set()
for (const escopo of [[], ['--global']]) {
  try {
    emails.add(git('config', ...escopo, 'user.email'))
  } catch {
    // chave não configurada
  }
}
for (const email of emails) {
  if (email && !email.endsWith('@users.noreply.github.com'))
    padroes.push(['e-mail pessoal', new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')])
}

const achados = []
for (const arquivo of arquivos) {
  if (arquivo === proprio) continue
  if (arquivo.endsWith('.jsonl') && !arquivo.startsWith('tests/fixtures/')) {
    achados.push(`${arquivo}: log .jsonl fora de tests/fixtures`)
    continue
  }
  let texto
  try {
    texto = readFileSync(arquivo, 'utf8')
  } catch {
    continue // apagado no disco mas ainda no índice
  }
  texto.split('\n').forEach((linha, i) => {
    for (const [nome, re] of padroes) if (re.test(linha)) achados.push(`${arquivo}:${i + 1}: ${nome}`)
  })
}

if (achados.length) {
  console.error(`check-segredos: ${achados.length} problema(s)\n` + achados.join('\n'))
  process.exit(1)
}
console.log(`check-segredos: ok (${arquivos.length} arquivos)`)
