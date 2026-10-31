// Hook UserPromptSubmit: avisa uma vez cada alerta novo. Só lê data/status.json (rápido, sem rede);
// app desligado ou qualquer erro = silêncio, para nunca atrapalhar o Claude Code.
import fs from 'node:fs'
import path from 'node:path'

const dados = process.env.MTM_DATA_DIR ?? path.join(import.meta.dirname, '..', 'data')
try {
  const status = JSON.parse(fs.readFileSync(path.join(dados, 'status.json'), 'utf8'))
  if (Date.now() - status.geradoEm < 10 * 60_000) {
    const arquivo = path.join(dados, 'hook-avisados.json')
    let vistos = {}
    try {
      vistos = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    } catch {
      // primeiro aviso
    }
    const novos = (status.alertas ?? []).filter((a) => !(a.id in vistos))
    if (novos.length) {
      for (const a of novos) vistos[a.id] = Date.now()
      fs.writeFileSync(arquivo, JSON.stringify(vistos))
      const msg = `my-tokken-meter: ${novos.map((a) => a.texto).join(' · ')}`
      process.stdout.write(
        JSON.stringify({
          systemMessage: msg,
          hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
        }),
      )
    }
  }
} catch {
  // sem status: app desligado
}
process.exit(0)
