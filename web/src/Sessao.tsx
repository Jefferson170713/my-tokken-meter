import { Info, Plug } from 'lucide-react'
import type { Periodo, Resumo } from './api.ts'
import { Barra, nivel } from './ui.tsx'

const hora = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function falta(ms: number) {
  const min = Math.max(0, Math.ceil(ms / 60_000))
  if (min >= 24 * 60) return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`
}

// Fim de cada período: a sessão de 5h vem do horário oficial (statusline) ou da estimativa pelos logs.
function janela(p: Periodo, r: Resumo, agora: number): { inicio: number; fim: number } | null {
  const ini = r.periodos[p].inicio
  const d = new Date(ini)
  if (p === 'janela5h') {
    const oficial = r.plano?.renova5h && r.plano.renova5h > agora ? r.plano.renova5h : null
    const fim = oficial ?? r.sessao?.fim ?? null
    return fim ? { inicio: fim - 5 * 3600_000, fim } : null
  }
  if (p === 'dia')
    return { inicio: ini, fim: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() }
  if (p === 'semana')
    return { inicio: ini, fim: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime() }
  return { inicio: ini, fim: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() }
}

const ROTULO: Record<Periodo, string> = {
  janela5h: 'do tempo',
  dia: 'do dia',
  semana: 'da semana',
  mes: 'do mês',
}

// Rodapé dos cards: quando o período renova e quanto do tempo já passou (desenho aprovado no FigCraft).
export function Renovacao({ p, resumo, agora }: { p: Periodo; resumo: Resumo; agora: number }) {
  const j = janela(p, resumo, agora)
  const borda = {
    borderTop: '1px solid var(--border)',
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  }
  if (!j)
    return (
      <div style={borda}>
        <span className="muted" style={{ fontSize: 12 }}>
          Nenhuma sessão aberta. A próxima começa na sua primeira mensagem.
        </span>
      </div>
    )
  const pct = Math.min(100, Math.max(0, ((agora - j.inicio) / (j.fim - j.inicio)) * 100))
  const quando =
    p === 'janela5h' || p === 'dia'
      ? `às ${hora(j.fim)}`
      : p === 'semana'
        ? `${new Date(j.fim).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}, ${hora(j.fim)}`
        : `1º ${new Date(j.fim).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`
  return (
    <div style={borda}>
      <div className="topo">
        <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
          Renova em {falta(j.fim - agora)}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {quando}
        </span>
      </div>
      <div
        className="barra"
        style={{ height: 6 }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-label={`Tempo ${ROTULO[p]}`}
      >
        <div style={{ width: `${pct}%`, background: 'var(--text-muted)' }} />
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        {Math.round(pct)}% {ROTULO[p]}
        {p === 'janela5h' && ` · desde ${hora(j.inicio)}`}
        {p === 'janela5h' && !(resumo.plano?.renova5h && resumo.plano.renova5h > agora) && ' (estimado)'}
      </span>
    </div>
  )
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

// Card "Plano Claude" ao lado do gráfico: % real da janela de 5h e da semana, vinda da statusline.
export function CardPlano({ resumo, agora }: { resumo: Resumo; agora: number }) {
  const p = resumo.plano
  const data = (ts: number | null) =>
    ts
      ? new Date(ts).toLocaleString('pt-BR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
  return (
    <section className="card" style={{ flex: '0 0 340px' }} aria-label="Plano Claude">
      <div className="topo">
        <h2>Plano Claude</h2>
        <span
          className="pilula"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontFamily: 'inherit' }}
        >
          % real · via statusline
        </span>
      </div>
      {p?.cincoH != null ? (
        <>
          <Medidor
            rotulo="Janela de 5h"
            pct={p.cincoH}
            detalhe={`renova às ${p.renova5h ? hora(p.renova5h) : '—'}`}
            limiar={resumo.limiar}
          />
          {p.semana != null && (
            <Medidor
              rotulo="Semana"
              pct={p.semana}
              detalhe={`renova ${data(p.renovaSemana)}`}
              limiar={resumo.limiar}
            />
          )}
          <div className="muted" style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <Info className="icone" aria-hidden />
            Atualizado {Math.max(0, Math.round((agora - p.em) / 60_000))} min atrás. Só muda enquanto o Claude
            Code está em uso.
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 10 }} className="muted">
          <Plug className="icone" aria-hidden />
          <span>
            Ainda sem dados. Com a statusline instalada (npm run integrar), a % real aparece aqui na próxima
            mensagem que você mandar ao Claude.
          </span>
        </div>
      )}
    </section>
  )
}
