import http from 'node:http'
import { obterCotacao } from '../core/cambio.ts'
import { lerConfig, salvarConfig } from '../core/config.ts'
import { lerConta, type Conta } from '../core/conta.ts'
import { abrirDb } from '../core/db.ts'
import { ingerir, totalIgnoradas } from '../core/ingest.ts'
import { pastaDados, pastaLogs } from '../core/paths.ts'
import { tabelaInfo } from '../core/prices.ts'
import { historico, resumo, type Agrupar } from '../core/summary.ts'

export const PORTA = Number(process.env.MTM_PORTA ?? 5178)
const LIMITE_CORPO = 64 * 1024

type Opcoes = { porta?: number; dados?: string; logs?: string }
type Rota = (url: URL, corpo: unknown) => Promise<[number, unknown]> | [number, unknown]

export function criarServidor(opcoes: Opcoes = {}) {
  let porta = opcoes.porta ?? PORTA
  const dados = opcoes.dados ?? pastaDados()
  const logs = opcoes.logs ?? pastaLogs()
  const db = abrirDb(dados)
  let ultimaLeitura = 0
  let erroLeitura: string | null = null
  let conta: { valor: Conta; em: number } | null = null

  function ler() {
    try {
      ingerir(db, logs)
      erroLeitura = null
    } catch (e) {
      erroLeitura = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'pasta-nao-encontrada' : String(e)
    }
    ultimaLeitura = Date.now()
  }

  const rotas: Record<string, Rota> = {
    'GET /api/health': () => [200, { ok: true }],
    'GET /api/resumo': async () => {
      if (Date.now() - ultimaLeitura > 5000) ler()
      if (erroLeitura) return [503, { erro: erroLeitura, pastaLogs: logs }]
      const cfg = lerConfig(dados)
      return [
        200,
        {
          periodos: resumo(db, cfg),
          moeda: cfg.moeda,
          unidade: cfg.unidade,
          limiar: cfg.limiar,
          cotacao: await obterCotacao(dados),
          linhasIgnoradas: totalIgnoradas(db),
          ultimaLeitura,
          tabelaPrecos: tabelaInfo,
        },
      ]
    },
    'GET /api/historico': (url) => {
      const agrupar = (url.searchParams.get('agrupar') ?? 'dia') as Agrupar
      if (!['dia', 'sessao', 'projeto', 'modelo'].includes(agrupar))
        return [400, { erro: 'agrupar inválido' }]
      // vazio vira NaN (Number('') seria 0) e cai no 400
      const num = (nome: string, padrao: number) => {
        const v = url.searchParams.get(nome)
        return v === null ? padrao : v.trim() === '' ? NaN : Number(v)
      }
      const ate = num('ate', Date.now())
      const de = num('de', ate - 14 * 86400_000)
      if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate)
        return [400, { erro: 'período inválido' }]
      return [200, historico(db, lerConfig(dados), de, ate, agrupar)]
    },
    'GET /api/config': () => [200, lerConfig(dados)],
    'PUT /api/config': (_url, corpo) => {
      try {
        return [200, salvarConfig(corpo, dados)]
      } catch (e) {
        return [400, { erro: (e as Error).message }]
      }
    },
    'GET /api/conta': async () => {
      if (!conta || Date.now() - conta.em > 60_000) conta = { valor: await lerConta(), em: Date.now() }
      return [200, conta.valor]
    },
    'GET /api/cambio': async () => [200, await obterCotacao(dados)],
  }

  const servidor = http.createServer(async (req, res) => {
    const responder = (status: number, corpo: unknown) => {
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(JSON.stringify(corpo))
    }
    // só aceita o próprio endereço: bloqueia DNS rebinding contra o PUT /api/config
    if (req.headers.host !== `127.0.0.1:${porta}` && req.headers.host !== `localhost:${porta}`)
      return responder(403, { erro: 'host não permitido' })
    // navegador vindo de outro site: recusa mesmo nos GETs
    const origem = req.headers.origin
    if (origem && origem !== `http://127.0.0.1:${porta}` && origem !== `http://localhost:${porta}`)
      return responder(403, { erro: 'origem não permitida' })
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const rota = rotas[`${req.method} ${url.pathname}`]
    if (!rota) return responder(404, { erro: 'não encontrado' })
    try {
      let corpo: unknown
      if (req.method === 'PUT') {
        if (Number(req.headers['content-length'] ?? 0) > LIMITE_CORPO) {
          res.setHeader('connection', 'close')
          return responder(413, { erro: 'corpo grande demais' })
        }
        // junta os Buffers e decodifica uma vez: acento partido entre pedaços não se corrompe
        const partes: Buffer[] = []
        let bytes = 0
        for await (const parte of req as AsyncIterable<Buffer>) {
          bytes += parte.length
          if (bytes <= LIMITE_CORPO) partes.push(parte) // além do limite só drena, para o 413 chegar
        }
        if (bytes > LIMITE_CORPO) return responder(413, { erro: 'corpo grande demais' })
        try {
          corpo = JSON.parse(Buffer.concat(partes).toString('utf8'))
        } catch {
          return responder(400, { erro: 'JSON inválido' })
        }
      }
      const [status, saida] = await rota(url, corpo)
      responder(status, saida)
    } catch (e) {
      console.error(e)
      responder(500, { erro: 'erro interno' })
    }
  })
  // porta 0 (testes): o Host aceito passa a ser a porta que o sistema escolheu
  servidor.on('listening', () => {
    const endereco = servidor.address()
    if (endereco && typeof endereco === 'object') porta = endereco.port
  })

  return { servidor, ler, db, porta: () => porta }
}

if (import.meta.main) {
  if (!Number.isInteger(PORTA) || PORTA < 1 || PORTA > 65535) {
    console.error(`MTM_PORTA inválida: "${process.env.MTM_PORTA}". Use um número de 1 a 65535.`)
    process.exit(1)
  }
  const { servidor, ler } = criarServidor()
  ler()
  setInterval(ler, 30_000).unref()
  servidor.on('error', (e: NodeJS.ErrnoException) => {
    console.error(
      e.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. Feche o outro app ou defina MTM_PORTA.` : e,
    )
    process.exit(1)
  })
  servidor.listen(PORTA, '127.0.0.1', () => console.log(`my-tokken-meter em http://127.0.0.1:${PORTA}`))
}
