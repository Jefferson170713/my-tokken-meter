import {
  Calendar,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  Cpu,
  FileSearch,
  FolderGit2,
  Info,
  OctagonAlert,
  Plug,
  RefreshCw,
  SlidersHorizontal,
  Terminal,
  Timer,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { chaveDia } from '../../core/periods.ts'
import { api, ErroApi, type LinhaHistorico, type Periodo, type Resumo } from './api.ts'
import { dataLonga, dinheiro, emReais, haQuanto, inteiro, tokens, type Exibicao } from './format.ts'
import { CardSessao } from './Sessao.tsx'
import { Banner, Barra, Cabecalho, local, nivel, Segmentos } from './ui.tsx'

type Props = {
  resumo: Resumo | null
  erro: Error | null
  exib: Exibicao
  agora: number
  recarregar: () => void
  mudarMoeda: (m: 'BRL' | 'USD') => void
}

const PERIODOS: { p: Periodo; rotulo: string; Icone: typeof Timer }[] = [
  { p: 'janela5h', rotulo: 'Janela de 5h', Icone: Timer },
  { p: 'dia', rotulo: 'Hoje', Icone: Calendar },
  { p: 'semana', rotulo: 'Semana', Icone: CalendarRange },
  { p: 'mes', rotulo: 'Mês', Icone: CalendarDays },
]
const NOME_PERIODO: Record<Periodo, string> = {
  janela5h: 'da janela de 5h',
  dia: 'de hoje',
  semana: 'da semana',
  mes: 'do mês',
}

export function SeletorMoeda({
  exib,
  mudarMoeda,
}: {
  exib: Exibicao
  mudarMoeda: (m: 'BRL' | 'USD') => void
}) {
  return (
    <Segmentos
      rotulo="Moeda"
      valor={exib.moeda}
      aoMudar={mudarMoeda}
      opcoes={[
        { valor: 'BRL', texto: <span className="mono">R$</span> },
        { valor: 'USD', texto: <span className="mono">US$</span> },
      ]}
    />
  )
}

function subtituloCotacao(r: Resumo, exib: Exibicao): string {
  const base = `${dataLonga(Date.now())} · estimado com preços da API`
  if (exib.moeda === 'USD') return base
  if (!r.cotacao) return `${base} · sem cotação: mostrando em US$`
  const c = r.cotacao.cotacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return `${base} · US$ 1 = R$ ${c} (PTAX ${r.cotacao.dataHora.slice(8, 10)}/${r.cotacao.dataHora.slice(5, 7)})${r.cotacao.antiga ? ', última salva' : ''}`
}

export function Dashboard({ resumo, erro, exib, agora, recarregar, mudarMoeda }: Props) {
  const [onboarding, setOnboarding] = useState(local.ler('mtm-onboarding') !== 'ok')
  const [dias, setDias] = useState<LinhaHistorico[]>([])
  const [modelos, setModelos] = useState<LinhaHistorico[]>([])
  const [projetos, setProjetos] = useState<LinhaHistorico[]>([])
  const [dispensados, setDispensados] = useState<string[]>(() => JSON.parse(local.ler('mtm-avisos') ?? '[]'))

  const inicioDia = resumo?.periodos.dia.inicio
  const leitura = resumo?.ultimaLeitura
  useEffect(() => {
    if (inicioDia === undefined) return
    const fim = Date.now()
    api.historico('dia', inicioDia - 13 * 86400_000, fim).then(setDias, () => setDias([]))
    api.historico('modelo', inicioDia, fim).then(setModelos, () => setModelos([]))
    api.historico('projeto', inicioDia, fim).then(setProjetos, () => setProjetos([]))
  }, [inicioDia, leitura])

  if (erro) {
    const pasta = erro instanceof ErroApi && erro.status === 503
    return (
      <div className="estado">
        <div className="bolha" style={{ background: 'var(--red-soft)', border: 0 }}>
          <OctagonAlert className="icone" color="var(--red)" aria-hidden />
        </div>
        <h2>{pasta ? 'Não foi possível ler os logs' : 'A API do app não respondeu'}</h2>
        <p>
          {pasta
            ? 'A pasta de logs do Claude Code não foi encontrada. O Claude Code já foi usado neste computador?'
            : 'O servidor local parou ou está reiniciando. Confira o terminal do npm run dev.'}
        </p>
        <div className="codigo" style={{ textAlign: 'left', width: 560 }}>
          <div style={{ color: 'var(--red)', fontWeight: 600 }}>
            {pasta ? 'ENOENT: pasta não encontrada' : erro.message}
          </div>
          {pasta && <div>~/.claude/projects</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="botao primario" onClick={recarregar}>
            Tentar de novo
          </button>
          <a className="botao" href="#/config" style={{ textDecoration: 'none' }}>
            Abrir configurações
          </a>
        </div>
        <span className="muted">
          Dica: se o Claude Code usa outra pasta, defina a variável CLAUDE_CONFIG_DIR.
        </span>
      </div>
    )
  }
  if (!resumo) return <div className="estado muted">Lendo os logs…</div>

  const semOrcamento = Object.values(resumo.periodos).every((v) => v.orcamento === null)
  if (resumo.periodos.mes.mensagens === 0 && dias.every((d) => d.mensagens === 0))
    return (
      <>
        <Cabecalho titulo="Visão geral" subtitulo={subtituloCotacao(resumo, exib)} />
        <div className="estado">
          <div className="bolha">
            <FileSearch className="icone" aria-hidden />
          </div>
          <h2>Nenhum uso registrado ainda</h2>
          <p>
            Assim que você usar o Claude Code, os números aparecem aqui sozinhos. A leitura roda a cada 30
            segundos.
          </p>
          <span className="codigo">~/.claude/projects · 0 mensagens</span>
        </div>
      </>
    )
  if (semOrcamento && onboarding)
    return (
      <PrimeiroUso
        resumo={resumo}
        aoPular={() => (local.gravar('mtm-onboarding', 'ok'), setOnboarding(false))}
      />
    )

  const lim = resumo.limiar
  const valorUso = (p: Periodo) =>
    resumo.unidade === 'tokens'
      ? tokens(resumo.periodos[p].tokens.total)
      : dinheiro(resumo.periodos[p].custoUsd, exib)
  const valorOrc = (v: number) => (resumo.unidade === 'tokens' ? `${tokens(v)} tokens` : dinheiro(v, exib))
  const avisos = PERIODOS.flatMap(({ p }) => {
    const r = resumo.periodos[p]
    const n = nivel(r.pct, lim)
    const id = `${p}-${p === 'janela5h' ? chaveDia(agora) : chaveDia(r.inicio)}-${n}`
    return n && !dispensados.includes(id) ? [{ p, n, id, r }] : []
  }).sort((a, b) => (a.n === 'estouro' ? -1 : 0) - (b.n === 'estouro' ? -1 : 0))
  const dispensar = (id: string) => {
    const lista = [...dispensados, id].slice(-50)
    setDispensados(lista)
    local.gravar('mtm-avisos', JSON.stringify(lista))
  }

  return (
    <>
      <Cabecalho titulo="Visão geral" subtitulo={subtituloCotacao(resumo, exib)}>
        <SeletorMoeda exib={exib} mudarMoeda={mudarMoeda} />
        <button className="botao" onClick={recarregar}>
          <RefreshCw className="icone" aria-hidden /> Atualizado {haQuanto(resumo.ultimaLeitura, agora)}
        </button>
      </Cabecalho>

      {semOrcamento && (
        <Banner
          tipo="info"
          titulo="Defina seus orçamentos para ver a % usada e receber alertas"
          texto="Sem orçamento o app só mostra o consumo. A % real do plano continua aparecendo ao lado."
          acao={
            <a className="botao primario" href="#/config" style={{ textDecoration: 'none' }}>
              Definir orçamentos
            </a>
          }
        />
      )}
      {avisos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {avisos.map(({ p, n, id, r }) => (
            <Banner
              key={id}
              tipo={n as 'alerta' | 'estouro'}
              titulo={
                n === 'estouro'
                  ? `Limite ${NOME_PERIODO[p]} atingido: ${Math.round(r.pct!)}% (${valorUso(p)} de ${valorOrc(r.orcamento!)})`
                  : `Restam ${Math.max(0, 100 - Math.round(r.pct!))}% do orçamento ${NOME_PERIODO[p]}: ${valorUso(p)} de ${valorOrc(r.orcamento!)}`
              }
              texto={
                p === 'janela5h'
                  ? 'A janela é móvel: o uso libera aos poucos, conforme as mensagens saem das últimas 5h.'
                  : 'Cada aviso aparece uma vez por período.'
              }
              aoFechar={() => dispensar(id)}
            />
          ))}
        </div>
      )}

      <div className="linha">
        {PERIODOS.map(({ p, rotulo, Icone }) => {
          const r = resumo.periodos[p]
          const n = nivel(r.pct, lim)
          return (
            <section key={p} className={`card ${n}`} aria-label={rotulo}>
              <div className="topo">
                <span className="rotulo">
                  <Icone className="icone" aria-hidden /> {rotulo}
                </span>
                {r.pct !== null && <span className={`pilula ${n}`}>{Math.round(r.pct)}%</span>}
              </div>
              <div className="valor" style={n === 'estouro' ? { color: 'var(--red)' } : undefined}>
                {resumo.unidade === 'tokens' ? tokens(r.tokens.total) : dinheiro(r.custoUsd, exib)}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {resumo.unidade === 'tokens'
                  ? dinheiro(r.custoUsd, exib)
                  : `${tokens(r.tokens.total)} tokens`}{' '}
                · {inteiro(r.mensagens)} mensagens
              </span>
              {r.pct !== null && <Barra pct={r.pct} classe={n} />}
              <div className="rodape">
                <span>{r.orcamento === null ? 'sem orçamento' : `de ${valorOrc(r.orcamento)}`}</span>
                <span
                  style={n ? { color: n === 'estouro' ? 'var(--red)' : 'var(--orange-text)' } : undefined}
                >
                  {n === 'estouro'
                    ? 'limite excedido'
                    : p === 'janela5h'
                      ? 'móvel, últimas 5h'
                      : p === 'dia'
                        ? 'até 23:59'
                        : p === 'semana'
                          ? `desde ${new Date(r.inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}`
                          : new Date(r.inicio).toLocaleDateString('pt-BR', { month: 'long' })}
                </span>
              </div>
            </section>
          )
        })}
      </div>

      <CardSessao resumo={resumo} exib={exib} agora={agora} />

      <div className="linha">
        <Grafico resumo={resumo} dias={dias} exib={exib} />
      </div>

      <div className="linha">
        <Tabela
          titulo="Por modelo · hoje"
          Icone={Cpu}
          linhas={modelos}
          coluna="Tokens"
          valor={(l) => tokens(l.tokens.total)}
          exib={exib}
        />
        <Tabela
          titulo="Por projeto · hoje"
          Icone={FolderGit2}
          linhas={projetos}
          coluna="Mensagens"
          valor={(l) => inteiro(l.mensagens)}
          nome={(c) => c.split(/[\\/]/).filter(Boolean).pop() ?? c}
          exib={exib}
        />
      </div>
      {(resumo.linhasIgnoradas > 0 || resumo.periodos.mes.semPreco.length > 0) && (
        <span className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Info className="icone" aria-hidden />
          {resumo.linhasIgnoradas > 0 &&
            `${resumo.linhasIgnoradas} linhas de log ignoradas por formato inesperado. `}
          {resumo.periodos.mes.semPreco.length > 0 &&
            `Modelos sem preço (tokens contados, custo não): ${resumo.periodos.mes.semPreco.join(', ')}.`}
        </span>
      )}
      {emReais(exib) || exib.moeda === 'USD' ? null : (
        <span className="muted" style={{ fontSize: 12 }}>
          Sem cotação do dólar no momento: valores em US$.
        </span>
      )}
    </>
  )
}

function Grafico({ resumo, dias, exib }: { resumo: Resumo; dias: LinhaHistorico[]; exib: Exibicao }) {
  const inicio = resumo.periodos.dia.inicio
  const tokensModo = resumo.unidade === 'tokens'
  const chaves = Array.from({ length: 14 }, (_, i) => chaveDia(inicio - (13 - i) * 86400_000 + 3600_000 * 12))
  const porDia = new Map(dias.map((d) => [d.chave, tokensModo ? d.tokens.total : d.custoUsd]))
  const valores = chaves.map((k) => porDia.get(k) ?? 0)
  const orc = resumo.periodos.dia.orcamento
  const max = Math.max(...valores, orc ?? 0) * 1.1 || 1
  const cor = (v: number) => {
    const n = orc ? nivel((v / orc) * 100, resumo.limiar) : ''
    return n === 'estouro' ? 'var(--red)' : n === 'alerta' ? 'var(--orange)' : 'var(--green)'
  }
  return (
    <section className="card" aria-label="Gasto por dia nos últimos 14 dias">
      <div className="topo">
        <h2>Gasto por dia · últimos 14 dias</h2>
        <span className="muted" style={{ fontSize: 12, display: 'flex', gap: 14 }}>
          <span>■ dentro</span>
          {orc !== null && (
            <span>
              <span style={{ color: 'var(--orange-text)' }}>- - -</span> orçamento diário{' '}
              {tokensModo ? `${tokens(orc)} tokens` : dinheiro(orc, exib)}
            </span>
          )}
        </span>
      </div>
      <div
        className="grafico"
        role="img"
        aria-label={valores
          .map((v, i) => `${chaves[i]}: ${tokensModo ? tokens(v) : dinheiro(v, exib)}`)
          .join('; ')}
      >
        {orc !== null && (
          <div className="limite" style={{ bottom: `calc(22px + ${(orc / max) * 100}% * (1 - 22 / 210))` }} />
        )}
        {valores.map((v, i) => (
          <div
            className="coluna"
            key={chaves[i]}
            title={`${chaves[i]}: ${tokensModo ? tokens(v) : dinheiro(v, exib)}`}
          >
            <div style={{ height: `${(v / max) * 100}%`, background: v ? cor(v) : 'var(--surface-2)' }} />
            <span style={i === 13 ? { color: 'var(--text)', fontWeight: 600 } : undefined}>
              {chaves[i].slice(8)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Tabela({
  titulo,
  Icone,
  linhas,
  coluna,
  valor,
  nome = (c) => c,
  exib,
}: {
  titulo: string
  Icone: typeof Cpu
  linhas: LinhaHistorico[]
  coluna: string
  valor: (l: LinhaHistorico) => string
  nome?: (chave: string) => string
  exib: Exibicao
}) {
  return (
    <section className="card" style={{ gap: 4 }} aria-label={titulo}>
      <div className="rotulo" style={{ color: 'var(--text)', paddingBottom: 8 }}>
        <Icone className="icone" aria-hidden />
        <h2>{titulo}</h2>
      </div>
      <table className="tabela">
        <thead>
          <tr>
            <th>{coluna === 'Tokens' ? 'Modelo' : 'Projeto'}</th>
            <th>{coluna}</th>
            <th>Custo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                Nada hoje ainda.
              </td>
            </tr>
          )}
          {linhas.slice(0, 5).map((l) => (
            <tr key={l.chave}>
              <td title={l.chave}>{nome(l.chave)}</td>
              <td>{valor(l)}</td>
              <td>{dinheiro(l.custoUsd, exib)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function PrimeiroUso({ resumo, aoPular }: { resumo: Resumo; aoPular: () => void }) {
  const passo = (Icone: typeof Plug, titulo: string, texto: string, lado: React.ReactNode) => (
    <div
      className="card"
      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, background: 'var(--bg)' }}
    >
      <Icone className="icone" aria-hidden />
      <div style={{ flex: 1 }}>
        <strong>{titulo}</strong>
        <div className="muted" style={{ fontSize: 13 }}>
          {texto}
        </div>
      </div>
      {lado}
    </div>
  )
  return (
    <>
      <Cabecalho
        titulo="Bem-vindo ao my-tokken-meter"
        subtitulo="Primeira leitura dos seus logs do Claude Code. Nada sai do seu computador."
      />
      <div className="estado">
        <section className="card" style={{ width: 720, gap: 20, padding: 32, textAlign: 'left' }}>
          <h2 style={{ fontSize: 22 }}>Vamos começar</h2>
          {passo(
            CircleCheck,
            'Logs encontrados',
            `${inteiro(resumo.periodos.mes.mensagens)} mensagens neste mês. O histórico fica guardado mesmo depois que o Claude apaga logs antigos.`,
            <span className="pilula" style={{ fontFamily: 'inherit' }}>
              pronto
            </span>,
          )}
          {passo(
            SlidersHorizontal,
            'Defina seus orçamentos',
            'Janela de 5h, dia, semana e mês, em dinheiro ou tokens. O alerta dispara aos 80%.',
            <a
              className="botao primario"
              href="#/config"
              style={{ textDecoration: 'none' }}
              onClick={aoPular}
            >
              Definir
            </a>,
          )}
          {passo(
            Plug,
            'Integre ao Claude Code',
            'Servidor MCP, aviso na conversa e statusline. O comando mostra o que muda e pede sua confirmação.',
            <span className="codigo" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Terminal className="icone" aria-hidden /> npm run integrar
            </span>,
          )}
          <button
            onClick={aoPular}
            className="muted"
            style={{ border: 0, background: 'none', textDecoration: 'underline', alignSelf: 'flex-start' }}
          >
            Pular por agora
          </button>
        </section>
      </div>
    </>
  )
}
