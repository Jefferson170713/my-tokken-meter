import { OctagonAlert, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'

// Nível visual de um percentual: verde abaixo do limiar, laranja a partir dele, vermelho a partir de 100%.
export function nivel(pct: number | null, limiar: number): '' | 'alerta' | 'estouro' {
  if (pct === null) return ''
  if (pct >= 100) return 'estouro'
  return pct >= limiar ? 'alerta' : ''
}

export function Barra({ pct, classe }: { pct: number; classe: string }) {
  return (
    <div
      className="barra"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={classe} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export function Banner({
  tipo,
  titulo,
  texto,
  aoFechar,
  acao,
}: {
  tipo: 'alerta' | 'estouro' | 'info'
  titulo: string
  texto: string
  aoFechar?: () => void
  acao?: ReactNode
}) {
  const Icone = tipo === 'estouro' ? OctagonAlert : TriangleAlert
  return (
    <div className={`banner ${tipo}`} role={tipo === 'info' ? 'status' : 'alert'}>
      {tipo !== 'info' && (
        <Icone
          className="icone"
          color={tipo === 'estouro' ? 'var(--red)' : 'var(--orange-text)'}
          aria-hidden
        />
      )}
      <div className="texto">
        <strong>{titulo}</strong>
        <span className="muted">{texto}</span>
      </div>
      {acao}
      {aoFechar && (
        <button className="fechar" onClick={aoFechar} aria-label="Dispensar aviso">
          <X className="icone" />
        </button>
      )}
    </div>
  )
}

export function Segmentos<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; texto: ReactNode }[]
  valor: T
  aoMudar: (v: T) => void
  rotulo: string
}) {
  return (
    <div className="segmentos" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} aria-pressed={o.valor === valor} onClick={() => aoMudar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function Alternar({
  ligado,
  aoMudar,
  rotulo,
}: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotulo: string
}) {
  return (
    <button
      className="alternar"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
    />
  )
}

export function Cabecalho({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo: string
  children?: ReactNode
}) {
  return (
    <header className="cabecalho">
      <div className="titulo">
        <h1>{titulo}</h1>
        <span className="muted">{subtitulo}</span>
      </div>
      {children}
    </header>
  )
}

// Converte "1.084,50" ou "54.2" em número; vazio vira null.
export function lerNumero(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : NaN
}

// Preferência só deste navegador (tema, avisos dispensados); falha em silêncio se o armazenamento estiver bloqueado.
export const local = {
  ler(chave: string): string | null {
    try {
      return localStorage.getItem(chave)
    } catch {
      return null
    }
  },
  gravar(chave: string, valor: string) {
    try {
      localStorage.setItem(chave, valor)
    } catch {
      // modo privado ou armazenamento bloqueado
    }
  },
}
