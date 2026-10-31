import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { obterCotacao } from '../core/cambio.ts'
import { lerConfig, salvarConfig } from '../core/config.ts'
import { lerConta, type Conta } from '../core/conta.ts'
import { abrirDb } from '../core/db.ts'
import { ingerir, totalIgnoradas } from '../core/ingest.ts'
import { pastaDados, pastaLogs } from '../core/paths.ts'
import { tabelaInfo, tabelaPadrao } from '../core/prices.ts'
import { historico, resumo, type Agrupar } from '../core/summary.ts'
import { alertasAtivos, filtrarNovos, gravarJson } from '../core/alerts.ts'
import { lerPlano } from '../core/plan.ts'
import { sessaoAtual } from '../core/sessao.ts'
import { notificarWindows } from './notify-windows.ts'

export const PORTA = Number(process.env.MTM_PORTA ?? 5178)
const LIMITE_CORPO = 64 * 1024
const RAIZ = path.join(import.meta.dirname, '..')
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
}

type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, proximo: () => void) => void
type Opcoes = { porta?: number; dados?: string; logs?: string; front?: Middleware; avisar?: boolean }

// Front já compilado (npm start): arquivos de dist/, e index.html para qualquer outra rota.
export function servirDist(pasta = path.join(RAIZ, 'dist')): Middleware {
  return (req, res, proximo) => {
    if (req.method !== 'GET') return proximo()
    const caminho = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let arquivo = path.join(pasta, caminho)
    if (!arquivo.startsWith(pasta)) return proximo() // ../ fora de dist
    if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory())
      arquivo = path.join(pasta, 'index.html')
    if (!fs.existsSync(arquivo)) return proximo()
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' })
    fs.createReadStream(arquivo).pipe(res)
  }
}
type Rota = (url: URL, corpo: unknown) => Promise<[number, unknown]> | [number, unknown]

export function criarServidor(opcoes: Opcoes = {}) {
  let porta = opcoes.porta ?? PORTA
  const dados = opcoes.dados ?? pastaDados()
  const logs = opcoes.logs ?? pastaLogs()
  const db = abrirDb(dados)
  let ultimaLeitura = 0
  let erroLeitura: string | null = null
  let conta: { valor: Conta; em: number } | null = null
  // a cada vez que o app sobe, pede para entrar de novo; quem entrou fica salvo em data/conta.json
  let entrou = false
  const arquivoConta = path.join(dados, 'conta.json')
  const ultimaConta = () => {
    try {
      return JSON.parse(fs.readFileSync(arquivoConta, 'utf8'))
    } catch {
      return null
    }
  }
  let front = opcoes.front

  function ler() {
    try {
      ingerir(db, logs)
      erroLeitura = null
    } catch (e) {
      erroLeitura = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'pasta-nao-encontrada' : String(e)
    }
    ultimaLeitura = Date.now()
    if (!erroLeitura) publicarStatus()
  }

  // status.json: o hook e a statusline do Claude Code leem só este arquivo, sem banco nem rede
  function publicarStatus() {
    const cfg = lerConfig(dados)
    const periodos = resumo(db, cfg)
    const alertas = alertasAtivos(periodos, cfg.limiar)
    const sessao = sessaoAtual(db, cfg)
    const plano = cfg.planoAtivo ? lerPlano(dados) : null
    gravarJson(path.join(dados, 'status.json'), {
      geradoEm: Date.now(),
      pct: Object.fromEntries(Object.entries(periodos).map(([p, r]) => [p, r.pct])),
      alertas,
      renova5h: plano?.renova5h && plano.renova5h > Date.now() ? plano.renova5h : (sessao?.fim ?? null),
    })
    if (opcoes.avisar)
      for (const a of filtrarNovos(path.join(dados, 'avisados-windows.json'), alertas))
        notificarWindows(a.nivel === 100 ? 'Limite atingido' : 'Uso do Claude em alerta', a.texto)
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
          sessao: sessaoAtual(db, cfg),
          plano: cfg.planoAtivo ? lerPlano(dados) : null,
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
      return [200, { ...conta.valor, entrou, ultima: ultimaConta() }]
    },
    'POST /api/entrar': async () => {
      conta = { valor: await lerConta(), em: Date.now() }
      if (!conta.valor.conectada) return [409, { erro: 'nenhuma conta conectada no Claude Code' }]
      const { email, plano, metodo } = conta.valor
      gravarJson(arquivoConta, { email, plano, metodo, entrouEm: Date.now() })
      entrou = true
      return [200, { ...conta.valor, entrou, ultima: ultimaConta() }]
    },
    'GET /api/cambio': async () => [200, await obterCotacao(dados)],
    'GET /api/precos': () => [200, { padrao: tabelaPadrao, ...tabelaInfo }],
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
    if (!rota) {
      if (front && !url.pathname.startsWith('/api/'))
        return front(req, res, () => responder(404, { erro: 'não encontrado' }))
      return responder(404, { erro: 'não encontrado' })
    }
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

  return { servidor, ler, db, porta: () => porta, usarFront: (m: Middleware) => (front = m) }
}

function abrirNavegador(url: string) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]]
  spawn(cmd, args as string[], { detached: true, stdio: 'ignore' }).unref()
}

if (import.meta.main) {
  if (!Number.isInteger(PORTA) || PORTA < 1 || PORTA > 65535) {
    console.error(`MTM_PORTA inválida: "${process.env.MTM_PORTA}". Use um número de 1 a 65535.`)
    process.exit(1)
  }
  const { servidor, ler, usarFront } = criarServidor({ avisar: true })
  ler()
  setInterval(ler, 30_000).unref()
  if (process.argv.includes('--dev')) {
    // Vite no mesmo processo e porta: front com recarga automática, sem proxy nem CORS
    const { createServer } = await import('vite')
    const vite = await createServer({
      configFile: path.join(RAIZ, 'vite.config.ts'),
      server: { middlewareMode: true, hmr: { server: servidor } },
      appType: 'spa',
    })
    usarFront(vite.middlewares)
  } else {
    if (!fs.existsSync(path.join(RAIZ, 'dist', 'index.html')))
      console.warn('Front não compilado: rode npm run build (ou use npm run dev).')
    usarFront(servirDist())
  }
  servidor.on('error', (e: NodeJS.ErrnoException) => {
    console.error(
      e.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. Feche o outro app ou defina MTM_PORTA.` : e,
    )
    process.exit(1)
  })
  servidor.listen(PORTA, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORTA}`
    console.log(`my-tokken-meter em ${url}`)
    if (process.argv.includes('--open')) abrirNavegador(url)
  })
}
