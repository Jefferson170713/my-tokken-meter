import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Moon,
  Sun,
  Terminal,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Periodo } from '../../core/periods.ts'
import type { Preco } from '../../core/prices.ts'
import { api, type Config, type Conta, type Resumo, type TabelaPrecos } from './api.ts'
import type { Tema } from './App.tsx'
import { emReais, type Exibicao } from './format.ts'
import { Alternar, Banner, Cabecalho, lerNumero, Segmentos } from './ui.tsx'

const CAMPOS: { p: Periodo; rotulo: string; Icone: typeof Timer }[] = [
  { p: 'janela5h', rotulo: 'Janela de 5h', Icone: Timer },
  { p: 'dia', rotulo: 'Dia', Icone: Calendar },
  { p: 'semana', rotulo: 'Semana', Icone: CalendarRange },
  { p: 'mes', rotulo: 'Mês', Icone: CalendarDays },
]
const COLUNAS: [keyof Preco, string][] = [
  ['input', 'Entrada'],
  ['output', 'Saída'],
  ['cacheWrite5m', 'Cache 5m'],
  ['cacheWrite1h', 'Cache 1h'],
  ['cacheRead', 'Cache leitura'],
]
const br = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

type Props = {
  resumo: Resumo | null
  exib: Exibicao
  tema: Tema
  setTema: (t: Tema) => void
  recarregar: () => void
}

export function Configuracoes({ resumo, exib, tema, setTema, recarregar }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [conta, setConta] = useState<Conta | null>(null)
  const [precos, setPrecos] = useState<{ padrao: TabelaPrecos; atualizadoEm: string } | null>(null)
  const [orc, setOrc] = useState<Record<Periodo, string>>({ janela5h: '', dia: '', semana: '', mes: '' })
  const [tabela, setTabela] = useState<Record<string, Record<string, string>>>({})
  const [msg, setMsg] = useState<{ tipo: 'info' | 'estouro'; texto: string } | null>(null)

  // dinheiro é guardado em US$; a tela mostra e edita na moeda escolhida
  const fator = emReais(exib) ? exib.cotacao!.cotacao : 1
  const simbolo = emReais(exib) ? 'R$' : 'US$'

  useEffect(() => {
    api.config().then(setCfg)
    api.conta().then(setConta, () => setConta(null))
    api.precos().then(setPrecos)
  }, [])
  useEffect(() => {
    if (!cfg) return
    const fmt = (v: number | null) => (v === null ? '' : cfg.unidade === 'tokens' ? String(v) : br(v * fator))
    setOrc({
      janela5h: fmt(cfg.orcamentos.janela5h),
      dia: fmt(cfg.orcamentos.dia),
      semana: fmt(cfg.orcamentos.semana),
      mes: fmt(cfg.orcamentos.mes),
    })
  }, [cfg, fator])
  useEffect(() => {
    if (!cfg || !precos) return
    const t: Record<string, Record<string, string>> = {}
    const modelos = [...Object.keys(precos.padrao), ...(resumo?.periodos.mes.semPreco ?? [])]
    for (const m of modelos) {
      const p = cfg.precos[m] ?? precos.padrao[m]
      t[m] = Object.fromEntries(COLUNAS.map(([c]) => [c, p ? br(p[c] as number, 3).replace(/0$/, '') : '']))
    }
    setTabela(t)
  }, [cfg, precos, resumo])

  if (!cfg) return <div className="estado muted">Carregando…</div>

  async function salvar(parcial: Partial<Config>, texto: string) {
    try {
      setCfg(await api.salvarConfig(parcial))
      setMsg({ tipo: 'info', texto })
      recarregar()
    } catch (e) {
      setMsg({ tipo: 'estouro', texto: (e as Error).message })
    }
  }
  function salvarOrcamentos() {
    const orcamentos = {} as Record<Periodo, number | null>
    for (const { p, rotulo } of CAMPOS) {
      const n = lerNumero(orc[p])
      if (Number.isNaN(n) || (n !== null && n <= 0))
        return setMsg({ tipo: 'estouro', texto: `Valor inválido em ${rotulo}.` })
      orcamentos[p] = n === null ? null : cfg!.unidade === 'tokens' ? Math.round(n) : n / fator
    }
    salvar({ orcamentos, limiar: cfg!.limiar }, 'Orçamentos salvos.')
  }
  function salvarPrecos() {
    const novos: TabelaPrecos = {}
    for (const [modelo, campos] of Object.entries(tabela)) {
      const preco = {} as Preco
      let vazio = false
      for (const [c] of COLUNAS) {
        const n = lerNumero(campos[c])
        if (n === null) vazio = true
        else if (Number.isNaN(n) || n < 0)
          return setMsg({ tipo: 'estouro', texto: `Preço inválido em ${modelo}.` })
        else (preco[c] as number) = n
      }
      if (vazio) continue
      const padrao = precos?.padrao[modelo]
      const igual =
        padrao && COLUNAS.every(([c]) => Math.abs((padrao[c] as number) - (preco[c] as number)) < 1e-9)
      if (!igual)
        novos[modelo] = padrao?.multiplicadorRapido
          ? { ...preco, multiplicadorRapido: padrao.multiplicadorRapido }
          : preco
    }
    salvar({ precos: novos }, 'Preços salvos. O histórico foi recalculado.')
  }

  return (
    <>
      <Cabecalho
        titulo="Configurações"
        subtitulo="Tudo fica salvo em data/config.json, só neste computador."
      />
      {msg && <Banner tipo={msg.tipo} titulo={msg.texto} texto="" aoFechar={() => setMsg(null)} />}
      <div className="linha" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card" aria-labelledby="t-orc">
            <h2 id="t-orc">Orçamentos</h2>
            <span className="muted">
              Base da % usada e dos alertas. Deixe vazio para não ter orçamento naquele período.
            </span>
            <Segmentos
              rotulo="Unidade do orçamento"
              valor={cfg.unidade}
              aoMudar={(unidade) =>
                salvar(
                  { unidade, orcamentos: { janela5h: null, dia: null, semana: null, mes: null } },
                  'Unidade trocada: defina os valores de novo.',
                )
              }
              opcoes={[
                { valor: 'usd', texto: 'Dinheiro' },
                { valor: 'tokens', texto: 'Tokens' },
              ]}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              {CAMPOS.map(({ p, rotulo, Icone }) => (
                <label key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="rotulo">
                    <Icone className="icone" aria-hidden /> {rotulo}
                  </span>
                  <span className="campo">
                    <span className="muted mono">{cfg.unidade === 'tokens' ? 'tok' : simbolo}</span>
                    <input
                      inputMode="decimal"
                      value={orc[p]}
                      onChange={(e) => setOrc({ ...orc, [p]: e.target.value })}
                      aria-label={`Orçamento: ${rotulo}`}
                    />
                  </span>
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="topo">
                <span style={{ fontWeight: 500 }}>Avisar quando chegar a</span>
                <span className="mono" style={{ color: 'var(--orange-text)', fontWeight: 700 }}>
                  {cfg.limiar}%
                </span>
              </span>
              <input
                type="range"
                min={50}
                max={99}
                value={cfg.limiar}
                onChange={(e) => setCfg({ ...cfg, limiar: Number(e.target.value) })}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Sempre avisa também aos 100%. Cada aviso aparece uma vez por período.
              </span>
            </label>
            <button className="botao primario" style={{ alignSelf: 'flex-start' }} onClick={salvarOrcamentos}>
              Salvar orçamentos
            </button>
          </section>

          <section className="card" aria-labelledby="t-precos">
            <h2 id="t-precos">Preços por modelo</h2>
            <span className="muted">US$ por milhão de tokens. Editar recalcula todo o histórico.</span>
            <div className="banner">
              <TriangleAlert className="icone" color="var(--orange-text)" aria-hidden />
              <span className="texto">
                Tabela de {precos?.atualizadoEm ?? '…'} · confira os valores na página oficial de preços da
                Anthropic.
              </span>
            </div>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Modelo</th>
                  {COLUNAS.map(([c, t]) => (
                    <th key={c}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(tabela).map(([modelo, campos]) => (
                  <tr key={modelo}>
                    <td>
                      {modelo}{' '}
                      {!precos?.padrao[modelo] && !cfg.precos[modelo] && (
                        <span className="pilula alerta">sem preço</span>
                      )}
                    </td>
                    {COLUNAS.map(([c]) => (
                      <td key={c}>
                        <input
                          className="campo"
                          style={{ width: 84, padding: '4px 8px', textAlign: 'right' }}
                          value={campos[c]}
                          inputMode="decimal"
                          aria-label={`${modelo} ${c}`}
                          onChange={(e) =>
                            setTabela({ ...tabela, [modelo]: { ...campos, [c]: e.target.value } })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="botao primario" style={{ alignSelf: 'flex-start' }} onClick={salvarPrecos}>
              Salvar preços
            </button>
          </section>
        </div>

        <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card" aria-labelledby="t-conta">
            <h2 id="t-conta">Conta do Claude</h2>
            <span className="muted">Detectada pelo Claude Code deste computador, sem ler o seu token.</span>
            {conta?.conectada ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div className="avatar">{(conta.email ?? '??').slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{conta.email}</strong>{' '}
                  {conta.plano && <span className="pilula">{conta.plano}</span>}
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {conta.metodo}
                  </div>
                </div>
              </div>
            ) : (
              <span className="muted">Nenhuma conta conectada.</span>
            )}
            <span
              className="codigo"
              style={{ display: 'inline-flex', gap: 8, alignItems: 'center', width: 'fit-content' }}
            >
              <Terminal className="icone" aria-hidden /> claude auth login · trocar de conta
            </span>
          </section>

          <section className="card" aria-labelledby="t-moeda">
            <h2 id="t-moeda">Moeda</h2>
            <Segmentos
              rotulo="Moeda"
              valor={cfg.moeda}
              aoMudar={(moeda) => salvar({ moeda }, 'Moeda trocada.')}
              opcoes={[
                { valor: 'BRL', texto: <span className="mono">R$</span> },
                { valor: 'USD', texto: <span className="mono">US$</span> },
              ]}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              {exib.cotacao
                ? `Cotação automática: US$ 1 = R$ ${br(exib.cotacao.cotacao, 4)} (PTAX do Banco Central, ${exib.cotacao.dataHora.slice(0, 16)}). Atualiza uma vez por dia; sem internet, usa a última.`
                : 'Sem cotação no momento (sem internet?). Os valores aparecem em US$ até a próxima busca.'}
            </span>
          </section>

          <section className="card" aria-labelledby="t-plano">
            <h2 id="t-plano">Plano Claude</h2>
            <div className="topo">
              <span>
                <strong style={{ fontWeight: 500 }}>Mostrar a % real do plano</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  Lida da statusline do Claude Code, sem usar o seu token.
                </div>
              </span>
              <Alternar
                ligado={cfg.planoAtivo}
                aoMudar={(planoAtivo) => salvar({ planoAtivo }, 'Preferência salva.')}
                rotulo="Mostrar a % real do plano"
              />
            </div>
          </section>

          <section className="card" aria-labelledby="t-integ">
            <h2 id="t-integ">Integrações com o Claude Code</h2>
            <span className="muted">
              Servidor MCP, aviso na conversa e statusline. Instaladas no seu ~/.claude com backup, dá para
              desfazer.
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['npm run integrar', 'npm run desintegrar'].map((c) => (
                <span
                  key={c}
                  className="codigo"
                  style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                >
                  <Terminal className="icone" aria-hidden /> {c}
                </span>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="t-aparencia">
            <h2 id="t-aparencia">Aparência</h2>
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
          </section>
        </div>
      </div>
    </>
  )
}
