import { Calendar, Cpu, FolderGit2, MessagesSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Agrupar } from '../../core/summary.ts'
import { api, type LinhaHistorico, type Resumo } from './api.ts'
import { SeletorMoeda } from './Dashboard.tsx'
import { dataCurta, dinheiro, inteiro, tokens, type Exibicao } from './format.ts'
import { Barra, Cabecalho, nivel, Segmentos } from './ui.tsx'

const ABAS: { valor: Agrupar; texto: string; Icone: typeof Calendar }[] = [
  { valor: 'dia', texto: 'Por dia', Icone: Calendar },
  { valor: 'sessao', texto: 'Por sessão', Icone: MessagesSquare },
  { valor: 'projeto', texto: 'Por projeto', Icone: FolderGit2 },
  { valor: 'modelo', texto: 'Por modelo', Icone: Cpu },
]

export function Historico({
  resumo,
  exib,
  mudarMoeda,
}: {
  resumo: Resumo | null
  exib: Exibicao
  mudarMoeda: (m: 'BRL' | 'USD') => void
}) {
  const [agrupar, setAgrupar] = useState<Agrupar>('dia')
  const [dias, setDias] = useState('14')
  const [linhas, setLinhas] = useState<LinhaHistorico[] | null>(null)
  const inicioDia = resumo?.periodos.dia.inicio

  useEffect(() => {
    if (inicioDia === undefined) return
    api
      .historico(agrupar, inicioDia - (Number(dias) - 1) * 86400_000, Date.now())
      .then(setLinhas, () => setLinhas([]))
  }, [agrupar, dias, inicioDia])

  if (!resumo) return <div className="estado muted">Lendo os logs…</div>
  const orcDia = resumo.periodos.dia.orcamento
  const total = (linhas ?? []).reduce((s, l) => s + l.custoUsd, 0)
  const pctDia = (l: LinhaHistorico) =>
    orcDia ? ((resumo.unidade === 'tokens' ? l.tokens.total : l.custoUsd) / orcDia) * 100 : null
  const acima = agrupar === 'dia' ? (linhas ?? []).filter((l) => (pctDia(l) ?? 0) >= 100) : []
  const nome = (c: string) =>
    agrupar === 'dia'
      ? dataCurta(c)
      : agrupar === 'projeto'
        ? (c.split(/[\\/]/).filter(Boolean).pop() ?? c)
        : agrupar === 'sessao'
          ? c.slice(0, 8)
          : c

  return (
    <>
      <Cabecalho
        titulo="Histórico"
        subtitulo={`Consumo dos últimos ${dias} dias · valores estimados com preços da API`}
      >
        <SeletorMoeda exib={exib} mudarMoeda={mudarMoeda} />
        <label className="botao">
          <Calendar className="icone" aria-hidden />
          <select
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            style={{ border: 0, background: 'none' }}
            aria-label="Período"
          >
            {['7', '14', '30', '90'].map((d) => (
              <option key={d} value={d}>
                Últimos {d} dias
              </option>
            ))}
          </select>
        </label>
      </Cabecalho>
      <Segmentos
        rotulo="Agrupar por"
        valor={agrupar}
        aoMudar={setAgrupar}
        opcoes={ABAS.map(({ valor, texto, Icone }) => ({
          valor,
          texto: (
            <>
              <Icone className="icone" aria-hidden /> {texto}
            </>
          ),
        }))}
      />
      <div className="linha">
        <section className="card" style={{ gap: 4 }}>
          <span className="muted">Total no período</span>
          <span className="valor" style={{ fontSize: 22 }}>
            {dinheiro(total, exib)}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {tokens((linhas ?? []).reduce((s, l) => s + l.tokens.total, 0))} tokens ·{' '}
            {inteiro((linhas ?? []).reduce((s, l) => s + l.mensagens, 0))} mensagens
          </span>
        </section>
        <section className="card" style={{ gap: 4 }}>
          <span className="muted">Média por dia</span>
          <span className="valor" style={{ fontSize: 22 }}>
            {dinheiro(total / Number(dias), exib)}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {orcDia === null
              ? 'sem orçamento diário'
              : `orçamento diário ${resumo.unidade === 'tokens' ? `${tokens(orcDia)} tokens` : dinheiro(orcDia, exib)}`}
          </span>
        </section>
        <section className="card" style={{ gap: 4 }}>
          <span className="muted">Dias acima do orçamento</span>
          <span className="valor" style={{ fontSize: 22, color: acima.length ? 'var(--red)' : undefined }}>
            {agrupar === 'dia' && orcDia !== null ? `${acima.length} de ${linhas?.length ?? 0}` : '—'}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {agrupar !== 'dia'
              ? 'veja na aba Por dia'
              : acima.map((l) => dataCurta(l.chave)).join(', ') || 'nenhum'}
          </span>
        </section>
      </div>
      <section className="card" style={{ gap: 0 }}>
        <table className="tabela">
          <thead>
            <tr>
              <th>
                {ABAS.find((a) => a.valor === agrupar)!
                  .texto.replace('Por ', '')
                  .replace(/^./, (c) => c.toUpperCase())}
              </th>
              <th>Mensagens</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Cache (leitura)</th>
              <th>Custo</th>
              {agrupar === 'dia' && <th style={{ width: 180 }}>% do orçamento</th>}
            </tr>
          </thead>
          <tbody>
            {linhas === null && (
              <tr>
                <td colSpan={7} className="muted">
                  Carregando…
                </td>
              </tr>
            )}
            {linhas?.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum uso no período.
                </td>
              </tr>
            )}
            {linhas?.map((l) => {
              const p = pctDia(l)
              const n = nivel(p, resumo.limiar)
              return (
                <tr key={l.chave}>
                  <td title={l.chave}>{nome(l.chave)}</td>
                  <td>{inteiro(l.mensagens)}</td>
                  <td>{tokens(l.tokens.input)}</td>
                  <td>{tokens(l.tokens.output)}</td>
                  <td>{tokens(l.tokens.cread)}</td>
                  <td>{dinheiro(l.custoUsd, exib)}</td>
                  {agrupar === 'dia' && (
                    <td>
                      {p === null ? (
                        '—'
                      ) : (
                        <span
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span style={{ width: 90 }}>
                            <Barra pct={p} classe={n} />
                          </span>
                          <span
                            style={{
                              width: 44,
                              color: n === 'estouro' ? 'var(--red)' : n ? 'var(--orange-text)' : undefined,
                            }}
                          >
                            {Math.round(p)}%
                          </span>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </>
  )
}
