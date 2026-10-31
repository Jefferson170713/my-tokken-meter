import { Hourglass } from 'lucide-react'
import type { Resumo } from './api.ts'
import { dinheiro, inteiro, type Exibicao } from './format.ts'
import { Barra, nivel } from './ui.tsx'

const H5 = 5 * 3600_000
const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function falta(ms: number) {
  const min = Math.max(0, Math.ceil(ms / 60_000))
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}

function Medidor({
  rotulo,
  pct,
  detalhe,
  limiar,
}: {
  rotulo: string
  pct: number
  detalhe: string
  limiar: number
}) {
  const n = nivel(pct, limiar)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="topo">
        <span className="muted" style={{ fontWeight: 500 }}>
          {rotulo}
        </span>
        <span
          className="mono"
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: n === 'estouro' ? 'var(--red)' : n ? 'var(--orange-text)' : undefined,
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <Barra pct={pct} classe={n} />
      <span className="muted" style={{ fontSize: 12 }}>
        {detalhe}
      </span>
    </div>
  )
}

// Sessão de 5h: quando renova, quanto do tempo já passou, quanto do limite foi usado e o gasto a cada 15 min.
export function CardSessao({ resumo, exib, agora }: { resumo: Resumo; exib: Exibicao; agora: number }) {
  const s = resumo.sessao
  const p = resumo.plano
  const oficial = p?.renova5h && p.renova5h > agora ? p.renova5h : null
  const fim = oficial ?? s?.fim ?? null

  if (!s || !fim)
    return (
      <section className="card" aria-label="Sessão de 5h">
        <div className="rotulo" style={{ color: 'var(--text)' }}>
          <Hourglass className="icone" aria-hidden />
          <h2>Sessão de 5h</h2>
        </div>
        <span className="muted">
          Nenhuma sessão aberta agora. A próxima começa na sua primeira mensagem ao Claude.
        </span>
      </section>
    )

  const inicio = fim - H5
  const pctTempo = Math.min(100, ((agora - inicio) / H5) * 100)
  const orc5h = resumo.periodos.janela5h.orcamento
  const pctOrc = orc5h && resumo.unidade === 'usd' ? (s.custoUsd / orc5h) * 100 : null
  const max = Math.max(...s.serie.map((f) => f.custoUsd)) || 1
  const atual = Math.floor((agora - s.inicio) / (15 * 60_000))

  return (
    <section className="card" aria-label="Sessão de 5h" style={{ gap: 16 }}>
      <div className="topo">
        <div className="rotulo" style={{ color: 'var(--text)' }}>
          <Hourglass className="icone" aria-hidden />
          <h2>Sessão de 5h</h2>
        </div>
        <span className="pilula" style={{ fontFamily: 'inherit' }}>
          {oficial ? 'horário oficial do Claude' : 'estimado pelos logs'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div className="muted">Renova em</div>
          <div className="valor">{falta(fim - agora)}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            às {hora(fim)} · começou às {hora(inicio)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Medidor
            rotulo="Tempo da sessão"
            pct={pctTempo}
            detalhe={`${falta(agora - inicio)} de 5h`}
            limiar={101}
          />
          {p?.cincoH != null ? (
            <Medidor
              rotulo="Limite do plano (real)"
              pct={p.cincoH}
              detalhe={`semana: ${Math.round(p.semana ?? 0)}% do limite`}
              limiar={resumo.limiar}
            />
          ) : pctOrc !== null ? (
            <Medidor
              rotulo="Seu orçamento de 5h"
              pct={pctOrc}
              detalhe={`${dinheiro(s.custoUsd, exib)} de ${dinheiro(orc5h!, exib)}`}
              limiar={resumo.limiar}
            />
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              Defina um orçamento de 5h nas Configurações ou rode npm run integrar para ver a % real do plano.
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="topo" style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Gasto a cada 15 min nesta sessão
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {dinheiro(s.custoUsd, exib)} · {inteiro(s.mensagens)} mensagens
          </span>
        </div>
        <div
          className="grafico"
          style={{ height: 110, gap: 4, paddingBottom: 18 }}
          role="img"
          aria-label={`Gasto da sessão por 15 minutos, de ${hora(s.inicio)} a ${hora(s.fim)}`}
        >
          {s.serie.map((f, i) => (
            <div className="coluna" key={f.inicio} title={`${hora(f.inicio)}: ${dinheiro(f.custoUsd, exib)}`}>
              <div
                style={{
                  height: `${(f.custoUsd / max) * 100}%`,
                  background: i > atual ? 'transparent' : i === atual ? 'var(--orange)' : 'var(--green)',
                  outline: i > atual ? '1px dashed var(--border)' : undefined,
                  minHeight: i > atual ? 0 : 2,
                }}
              />
              {i % 4 === 0 && <span>{hora(f.inicio)}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
