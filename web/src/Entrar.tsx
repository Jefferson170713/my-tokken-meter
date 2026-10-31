import { CircleCheck, Gauge, Info, RefreshCw, Terminal, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, type Conta } from './api.ts'

const iniciais = (email: string) => email.slice(0, 2).toUpperCase()

export function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [conta, setConta] = useState<Conta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const verificar = useCallback(() => {
    setErro(null)
    setConta(null)
    setTentativa((t) => t + 1)
  }, [])
  useEffect(() => {
    let vivo = true
    api.conta().then(
      (c) => vivo && setConta(c),
      (e: Error) => vivo && setErro(e.message),
    )
    return () => {
      vivo = false
    }
  }, [tentativa])

  return (
    <div className="entrar">
      <section className="card" aria-labelledby="titulo-entrar">
        <div className="marca" style={{ padding: 0 }}>
          <div className="logo">
            <Gauge className="icone" aria-hidden />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>my-tokken-meter</div>
            <div className="muted" style={{ fontSize: 12 }}>
              consumo do Claude Code
            </div>
          </div>
        </div>
        <div>
          <h1 id="titulo-entrar" style={{ margin: '0 0 6px', fontSize: 22 }}>
            Entrar com a sua conta do Claude
          </h1>
          <span className="muted">Usamos a conta que já está conectada no Claude Code deste computador.</span>
        </div>

        {!conta && !erro && <span className="muted">Verificando a conta…</span>}
        {conta?.conectada && (
          <>
            <div
              className="card"
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, background: 'var(--bg)' }}
            >
              <div className="avatar">{iniciais(conta.email ?? '??')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                  {conta.email}
                  {conta.plano && (
                    <span className="pilula" style={{ fontFamily: 'inherit' }}>
                      {conta.plano}
                    </span>
                  )}
                </div>
                <span className="muted mono" style={{ fontSize: 12 }}>
                  {conta.metodo} · logs em ~/.claude/projects
                </span>
              </div>
              <CircleCheck className="icone" color="var(--green-text)" aria-label="conta conectada" />
            </div>
            <button
              className="botao primario"
              style={{ justifyContent: 'center', padding: 12 }}
              onClick={aoEntrar}
            >
              Entrar no painel
            </button>
          </>
        )}
        {(conta?.conectada === false || erro) && (
          <>
            <div className="banner" role="alert">
              <TriangleAlert className="icone" color="var(--orange-text)" aria-hidden />
              <div className="texto">
                <strong>Nenhuma conta conectada no Claude Code</strong>
                <span className="muted">{erro ?? 'Faça login no terminal e volte aqui.'}</span>
              </div>
            </div>
            <span
              className="codigo"
              style={{ display: 'inline-flex', gap: 8, alignItems: 'center', width: 'fit-content' }}
            >
              <Terminal className="icone" aria-hidden /> claude auth login
            </span>
            <button
              className="botao primario"
              style={{ justifyContent: 'center', padding: 12 }}
              onClick={verificar}
            >
              <RefreshCw className="icone" aria-hidden /> Verificar de novo
            </button>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, fontSize: 12 }} className="muted">
          <Info className="icone" aria-hidden />
          Lido com claude auth status (e-mail e plano). O app não lê nem guarda o seu token.
        </div>
      </section>
    </div>
  )
}
