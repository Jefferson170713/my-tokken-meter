// Servidor MCP (stdio). Nunca use console.log aqui: o stdout é o canal do protocolo.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { alertasAtivos } from '../core/alerts.ts'
import { lerConfig } from '../core/config.ts'
import { abrirDb } from '../core/db.ts'
import { ingerir } from '../core/ingest.ts'
import { lerPlano } from '../core/plan.ts'
import { sessaoAtual } from '../core/sessao.ts'
import { historico, resumo, type Agrupar } from '../core/summary.ts'

const db = abrirDb()
const usd = (v: number) => `US$ ${v.toFixed(2).replace('.', ',')}`
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const mil = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `${Math.round(n / 1e3)} mil`

// Lê os logs só quando uma ferramenta é chamada: cada sessão do Claude Code sobe um processo deste.
function atualizar() {
  try {
    ingerir(db)
  } catch (e) {
    console.error('my-tokken-meter: leitura dos logs falhou:', e)
  }
}

function texto(t: string) {
  return { content: [{ type: 'text' as const, text: t }] }
}

const servidor = new McpServer({ name: 'my-tokken-meter', version: '0.1.0' })

servidor.registerTool(
  'consumo_atual',
  {
    description:
      'Consumo do Claude Code agora: janela de 5h, hoje, semana e mês (custo estimado com preços da API, tokens, mensagens e % do orçamento do usuário) e quando a sessão de 5h renova.',
  },
  async () => {
    atualizar()
    const cfg = lerConfig()
    const r = resumo(db, cfg)
    const s = sessaoAtual(db, cfg)
    const plano = cfg.planoAtivo ? lerPlano() : null
    const nomes = { janela5h: 'Janela de 5h', dia: 'Hoje', semana: 'Semana', mes: 'Mês' } as const
    const linhas = (Object.keys(nomes) as (keyof typeof nomes)[]).map((p) => {
      const v = r[p]
      const pct = v.pct === null ? 'sem orçamento' : `${Math.round(v.pct)}% do orçamento`
      return `${nomes[p]}: ${usd(v.custoUsd)} estimado, ${mil(v.tokens.total)} tokens, ${v.mensagens} mensagens, ${pct}`
    })
    const renova = plano?.renova5h && plano.renova5h > Date.now() ? plano.renova5h : s?.fim
    if (renova)
      linhas.push(`Sessão de 5h renova às ${hora(renova)}${plano?.renova5h ? '' : ' (estimado pelos logs)'}`)
    if (plano?.cincoH != null)
      linhas.push(
        `Plano Claude: ${Math.round(plano.cincoH)}% da janela de 5h, ${Math.round(plano.semana ?? 0)}% da semana`,
      )
    return texto(linhas.join('\n'))
  },
)

servidor.registerTool(
  'consumo_periodo',
  {
    description:
      'Consumo do Claude Code entre duas datas (AAAA-MM-DD), agrupado por dia, sessão, projeto ou modelo.',
    inputSchema: {
      de: z.string().describe('Data inicial, AAAA-MM-DD'),
      ate: z.string().optional().describe('Data final, AAAA-MM-DD (padrão: hoje)'),
      agrupar: z.enum(['dia', 'sessao', 'projeto', 'modelo']).optional().describe('Padrão: dia'),
    },
  },
  async ({ de, ate, agrupar }) => {
    const ini = new Date(`${de}T00:00:00`).getTime()
    const fim = ate ? new Date(`${ate}T23:59:59.999`).getTime() : Date.now()
    if (Number.isNaN(ini) || Number.isNaN(fim) || ini > fim) return texto('Datas inválidas: use AAAA-MM-DD.')
    atualizar()
    const h = historico(db, lerConfig(), ini, fim, (agrupar ?? 'dia') as Agrupar)
    if (!h.length) return texto('Nenhum uso no período.')
    const total = h.reduce((s, l) => s + l.custoUsd, 0)
    return texto(
      [
        ...h.map(
          (l) => `${l.chave}: ${usd(l.custoUsd)}, ${mil(l.tokens.total)} tokens, ${l.mensagens} mensagens`,
        ),
        `Total: ${usd(total)}`,
      ].join('\n'),
    )
  },
)

servidor.registerTool(
  'status_orcamento',
  { description: 'Alertas de orçamento ativos (80% e 100%) e o limiar configurado pelo usuário.' },
  async () => {
    atualizar()
    const cfg = lerConfig()
    const alertas = alertasAtivos(resumo(db, cfg), cfg.limiar)
    return texto(
      alertas.length ? alertas.map((a) => a.texto).join('\n') : `Nenhum alerta. Limiar: ${cfg.limiar}%.`,
    )
  },
)

await servidor.connect(new StdioServerTransport())
