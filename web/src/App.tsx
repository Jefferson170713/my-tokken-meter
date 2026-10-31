import { Gauge, History, Moon, Settings, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, type Config, type Resumo } from './api.ts'
import { Configuracoes } from './Configuracoes.tsx'
import { Dashboard } from './Dashboard.tsx'
import { Entrar } from './Entrar.tsx'
import { haQuanto, inteiro, type Exibicao } from './format.ts'
import { Historico } from './Historico.tsx'
import { local, Segmentos } from './ui.tsx'

type Rota = 'visao' | 'historico' | 'config'
const rotaAtual = (): Rota =>
  location.hash === '#/historico' ? 'historico' : location.hash === '#/config' ? 'config' : 'visao'
export type Tema = 'escuro' | 'claro'

export function App() {
  const [tema, setTema] = useState<Tema>(local.ler('mtm-tema') === 'claro' ? 'claro' : 'escuro')
  const [rota, setRota] = useState<Rota>(rotaAtual)
  const [entrou, setEntrou] = useState(() => {
    try {
      return sessionStorage.getItem('mtm-entrou') === '1'
    } catch {
      return false
    }
  })
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState<Error | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    local.gravar('mtm-tema', tema)
  }, [tema])
  useEffect(() => {
    const mudou = () => setRota(rotaAtual())
    addEventListener('hashchange', mudou)
    return () => removeEventListener('hashchange', mudou)
  }, [])

  // recarregar() só muda a versão; o efeito busca de novo
  const carregar = useCallback(() => setVersao((v) => v + 1), [])
  useEffect(() => {
    if (!entrou) return
    let vivo = true
    const buscar = () =>
      api.resumo().then(
        (r) => vivo && (setResumo(r), setErro(null), setAgora(Date.now())),
        (e: Error) => vivo && (setErro(e), setAgora(Date.now())),
      )
    buscar()
    const t = setInterval(buscar, 15_000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [entrou, versao])

  if (!entrou)
    return (
      <Entrar
        aoEntrar={() => {
          try {
            sessionStorage.setItem('mtm-entrou', '1')
          } catch {
            // sem sessionStorage: pede de novo na próxima vez
          }
          setEntrou(true)
        }}
      />
    )

  const exib: Exibicao = { moeda: resumo?.moeda ?? 'BRL', cotacao: resumo?.cotacao ?? null }
  const mudarMoeda = async (moeda: Config['moeda']) => {
    await api.salvarConfig({ moeda })
    await carregar()
  }
  const links: [Rota, string, string, typeof Gauge][] = [
    ['visao', '#/', 'Visão geral', Gauge],
    ['historico', '#/historico', 'Histórico', History],
    ['config', '#/config', 'Configurações', Settings],
  ]

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <div className="logo">
            <Gauge className="icone" aria-hidden />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>my-tokken-meter</div>
            <div className="muted" style={{ fontSize: 12 }}>
              consumo do Claude Code
            </div>
          </div>
        </div>
        <nav style={{ display: 'contents' }} aria-label="Navegação principal">
          {links.map(([r, href, texto, Icone]) => (
            <a
              key={r}
              href={href}
              className={`nav ${rota === r ? 'ativo' : ''}`}
              aria-current={rota === r ? 'page' : undefined}
            >
              <Icone className="icone" aria-hidden />
              {texto}
            </a>
          ))}
        </nav>
        <div className="espaco" />
        <div className="card" style={{ padding: 12, gap: 4, background: 'var(--bg)' }} role="status">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: erro ? 'var(--red)' : 'var(--green)',
              }}
            />
            {erro ? 'Leitura com erro' : 'Lendo logs locais'}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {resumo
              ? `Última leitura ${haQuanto(resumo.ultimaLeitura, agora)} · ${inteiro(resumo.periodos.mes.mensagens)} mensagens no mês`
              : `Última tentativa ${haQuanto(agora)}`}
          </span>
        </div>
        <Segmentos
          rotulo="Tema"
          valor={tema}
          aoMudar={setTema}
          opcoes={[
            {
              valor: 'escuro',
              texto: (
                <>
                  <Moon className="icone" aria-hidden /> Escuro
                </>
              ),
            },
            {
              valor: 'claro',
              texto: (
                <>
                  <Sun className="icone" aria-hidden /> Claro
                </>
              ),
            },
          ]}
        />
      </aside>
      <main className="conteudo">
        {rota === 'visao' && (
          <Dashboard
            resumo={resumo}
            erro={erro}
            exib={exib}
            agora={agora}
            recarregar={carregar}
            mudarMoeda={mudarMoeda}
          />
        )}
        {rota === 'historico' && <Historico resumo={resumo} exib={exib} mudarMoeda={mudarMoeda} />}
        {rota === 'config' && (
          <Configuracoes resumo={resumo} exib={exib} tema={tema} setTema={setTema} recarregar={carregar} />
        )}
      </main>
    </div>
  )
}
