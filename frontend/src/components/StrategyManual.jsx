import { useEffect, useRef, useState } from 'react'
import styles from './StrategyManual.module.css'

/*
 * StrategyManual — modal "biblioteca" con un manual simple de cada
 * estrategia que aparece en el dashboard.
 *
 * Estructura:
 *   - Sidebar izq.: índice clickeable agrupado (per-ticker / cross / portfolio)
 *   - Panel der.: secciones con qué hace + fórmula + cómo interpretar
 *
 * Referencia: Kakushadze & Serur (2018) "151 Trading Strategies".
 */

const SECTIONS = [
  {
    group: 'PER-TICKER',
    items: [
      {
        id: 'sma',
        label: 'SMA Crossover',
        paperRef: 'paper #11',
        what:
          'Estrategia de seguimiento de tendencia clásica: cuando el precio cruza por encima de una media móvil simple de largo plazo, hay momentum alcista — LONG. Cuando cruza por debajo, momentum bajista — SHORT.',
        formula: [
          'SMA(N) = (1/N) · Σ Closeₜ₋ᵢ   para i = 0..N-1',
          '',
          'signal = LONG   si Close > SMA(N)',
          'signal = SHORT  si Close < SMA(N)',
          'signal = NEUTRAL si están dentro del threshold ε',
        ],
        interpret:
          'Funciona en regímenes con tendencia clara. En mercados laterales genera muchos falsos cruces ("whipsaws"). N grande = menos ruido, más lag.',
      },
      {
        id: 'dma',
        label: 'DMA — Dual Moving Average',
        paperRef: 'paper #12',
        what:
          'Refina el SMA usando dos medias: una corta (rápida) y una larga (lenta). El signal se dispara solo cuando ambas se confirman entre sí.',
        formula: [
          'SMA_fast = SMA(N_fast),   SMA_slow = SMA(N_slow)   (N_fast < N_slow)',
          '',
          'signal = LONG   si SMA_fast > SMA_slow',
          'signal = SHORT  si SMA_fast < SMA_slow',
        ],
        interpret:
          'El cruce de medias filtra parte del ruido del SMA simple, pero introduce más lag. Comúnmente 20/50 o 50/200 (golden / death cross).',
      },
      {
        id: 'tma',
        label: 'TMA — Triple Moving Average',
        paperRef: 'paper #13',
        what:
          'Tres medias móviles (corta, media, larga) alineadas. El signal requiere que las tres confirmen la misma dirección — filtro más estricto que DMA.',
        formula: [
          'SMA_fast < SMA_mid < SMA_slow   →   SHORT',
          'SMA_fast > SMA_mid > SMA_slow   →   LONG',
          'cualquier otra disposición       →   NEUTRAL',
        ],
        interpret:
          'Más selectivo que DMA — genera menos signals pero con mayor confianza. Bueno para evitar falsos cruces en mercados ruidosos. Ej: 10/20/50.',
      },
      {
        id: 'pivot',
        label: 'Pivot Points',
        paperRef: 'paper #14',
        what:
          'Niveles de soporte y resistencia derivados del high, low y close del período anterior. Se usan como referencias intradiarias o multi-día.',
        formula: [
          'P  = (High + Low + Close) / 3',
          'R1 = 2P − Low      S1 = 2P − High',
          'R2 = P + (High−Low) S2 = P − (High−Low)',
          '',
          'signal = LONG   si Close > P',
          'signal = SHORT  si Close < P',
        ],
        interpret:
          'Niveles psicológicos donde el mercado tiende a reaccionar. Útil como contexto: si rompe R1 con volumen, breakout; si rebota en S1, mean reversion.',
      },
      {
        id: 'donchian',
        label: 'Donchian Channels',
        paperRef: 'paper #15',
        what:
          'Canal formado por el high máximo y el low mínimo de los últimos N períodos. Breakouts del canal indican momentum direccional.',
        formula: [
          'Upper(N) = max(Highₜ₋₁..ₜ₋ₙ)',
          'Lower(N) = min(Lowₜ₋₁..ₜ₋ₙ)',
          'Mid      = (Upper + Lower) / 2',
          '',
          'signal = LONG   si Close > Upper',
          'signal = SHORT  si Close < Lower',
        ],
        interpret:
          'Sistema turtle clásico. Captura tendencias largas pero tiene drawdowns importantes en mercados sin trend. N típico = 20 (4 semanas) ó 55.',
      },
    ],
  },
  {
    group: 'CROSS-SECTIONAL',
    items: [
      {
        id: 'momentum',
        label: 'Price Momentum',
        paperRef: 'paper #1',
        what:
          'Rankea los tickers del universo por su retorno acumulado en el período de formación, dejando un mes de "skip" para evitar el efecto de short-term reversal. Los winners siguen ganando, los losers siguen perdiendo.',
        formula: [
          'r_i = (P_{t−skip} / P_{t−skip−lookback}) − 1',
          '',
          'top decile (mayor r_i)    →   LONG',
          'bottom decile (menor r_i) →   SHORT',
        ],
        interpret:
          'Una de las anomalías más robustas (Jegadeesh & Titman 1993). Performa bien en tendencias largas; sufre durante crashes y reversiones bruscas. Lookback típico 12 meses, skip 1 mes.',
      },
      {
        id: 'low_vol',
        label: 'Low Volatility',
        paperRef: 'paper #4',
        what:
          'Anomalía: portfolios de baja volatilidad realizada generan retornos similares o superiores a los de alta vol, con menor riesgo. Va contra el CAPM.',
        formula: [
          'σ_i = std(retornos diarios de i en los últimos N días) · √252',
          '',
          'bottom decile (menor σ) →   LONG',
          'top decile (mayor σ)    →   SHORT',
        ],
        interpret:
          'Útil para portfolios defensivos. Tiende a sobreexponerse a sectores estables (utilities, consumer staples). Cuidado con régimen de tasas: low-vol stocks son sensibles a tasas.',
      },
      {
        id: 'value',
        label: 'Value — Book / Price',
        paperRef: 'paper #3',
        what:
          'Rankea por el ratio B/P (valor contable por acción sobre precio actual). Cuanto mayor B/P, más "barata" la acción respecto a sus activos.',
        formula: [
          'B/P_i = BookValuePerShare_i / Price_i',
          '',
          'top decile (mayor B/P)    →   LONG  (cheap)',
          'bottom decile (menor B/P) →   SHORT (expensive)',
        ],
        interpret:
          'Fama–French factor clásico. Requiere data manual: cada ticker debe tener una sheet FUNDAMENTALS con BookValuePerShare cargada a mano. Performa mal en bull markets growth-driven (2017-2021); rebota en rotaciones value.',
      },
      {
        id: 'multifactor',
        label: 'Multifactor',
        paperRef: 'paper #6',
        what:
          'Combina momentum + low-vol + value en un único score promedio de ranks. Diversifica entre factores y reduce drawdown vs cualquiera individual.',
        formula: [
          'score_i = (rank_mom_i + rank_lowvol_i + rank_value_i) / 3',
          '',
          'top decile (menor score) →   LONG',
          'bottom decile (mayor)    →   SHORT',
        ],
        interpret:
          'Reduce la variance del PnL porque los factores no están perfectamente correlacionados. Standard en quant institucional. Requiere que B/P esté disponible para todos los tickers.',
      },
      {
        id: 'pairs',
        label: 'Pairs Trading',
        paperRef: 'paper #8',
        what:
          'Dos tickers correlacionados deberían moverse en línea. Cuando uno sobrerinde respecto al promedio del par, está "rico" — se va SHORT; el otro está "barato" — se va LONG. Dollar-neutral.',
        formula: [
          'log_ret_i,t = log(P_i,t / P_i,t−1)',
          'demeaned_i  = log_ret_i,t − mean(log_ret par, t)',
          'score_i     = Σ demeaned_i,t   (sobre lookback)',
          '',
          'score_i > 0  →   SHORT i   (overperformed → expected revert down)',
          'score_i < 0  →   LONG  i   (underperformed → expected revert up)',
        ],
        interpret:
          'Market-neutral si los pesos están normalizados. Funciona mejor con pares del mismo sector / muy correlacionados. Riesgo: el spread puede divergir indefinidamente si los fundamentos cambian.',
      },
      {
        id: 'mean_reversion',
        label: 'Mean Reversion',
        paperRef: 'paper #9 / #10',
        what:
          'Generalización de pairs a N tickers. Calcula el retorno medio del cluster, identifica overperformers y underperformers, y apuesta a que reviertan hacia la media. Con "use clusters" toggle, agrupa por sector (paper #10) en vez de un único cluster (paper #9).',
        formula: [
          'Para cada cluster C:',
          '  cluster_mean_t = mean(log_ret_i,t)   para i ∈ C',
          '  demeaned_i,t   = log_ret_i,t − cluster_mean_t',
          '  score_i        = Σ demeaned_i,t   (sobre lookback)',
          '',
          'score_i > 0  →   SHORT i',
          'score_i < 0  →   LONG  i',
        ],
        interpret:
          'Más robusto que pairs por la diversificación. Clusters por sector reducen ruido idiosincrático. Performa mejor en horizontes cortos (días-semanas). Sufre cuando un ticker tiene noticia idiosincrática persistente.',
      },
    ],
  },
  {
    group: 'PORTFOLIO',
    items: [
      {
        id: 'portfolio',
        label: 'Sharpe-Max Optimizer',
        paperRef: 'paper #18',
        what:
          'Dado un set de tickers, encuentra los pesos que maximizan el ratio de Sharpe del portfolio (retorno esperado por unidad de riesgo). Opcionalmente con shortselling o long-only.',
        formula: [
          'maximize  Sharpe(w) = (wᵀμ − r_f) / √(wᵀΣw)',
          'subject to  Σ w_i = 1',
          '            w_i ≥ 0   (long-only)  /  sin restricción de signo (con shorts)',
          '',
          'μ = retornos esperados (media anualizada)',
          'Σ = matriz de covarianza anualizada',
          'r_f = risk-free rate (default 0)',
        ],
        interpret:
          'Markowitz frontier en el punto tangente. Sensible a errores en μ — pequeños cambios en retornos esperados pueden volcar el portfolio. En la práctica se combina con shrinkage o constraints. Útil como baseline para comparar contra equal-weight.',
      },
    ],
  },
]

export default function StrategyManual({ open, onClose }) {
  const allItems = SECTIONS.flatMap((g) => g.items)
  const [activeId, setActiveId] = useState(allItems[0].id)
  const contentRef = useRef(null)
  const tocRef = useRef(null)
  // Mientras dura el scroll programático del click en TOC, congelamos al spy
  const lockUntilRef = useRef(0)

  // Scroll-spy: detecta qué sección está más cerca del top del content area
  useEffect(() => {
    if (!open) return
    const root = contentRef.current
    if (!root) return

    const ids = allItems.map((it) => it.id)
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntilRef.current) return
        // Tomamos las entries visibles y elegimos la de mayor ratio;
        // si ninguna es "intersecting", caemos a la más cercana al top.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^manual-/, '')
          setActiveId((cur) => (cur === id ? cur : id))
        }
      },
      {
        root,
        // Trigger zone: la franja superior 40% del content area
        rootMargin: '0px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    ids.forEach((id) => {
      const el = document.getElementById(`manual-${id}`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando cambia activeId, llevamos el item del TOC a la vista (sticky-follow)
  useEffect(() => {
    if (!open || !tocRef.current) return
    const btn = tocRef.current.querySelector(`[data-toc-id="${activeId}"]`)
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeId, open])

  if (!open) return null

  const handleNav = (id) => {
    setActiveId(id)
    // Bloquear el spy ~700ms para que el smooth-scroll no nos pise el activeId
    lockUntilRef.current = Date.now() + 700
    const el = document.getElementById(`manual-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-label="Manual de estrategias">
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>BIBLIOTECA · MANUAL</div>
            <div className={styles.title}>Estrategias del dashboard</div>
            <div className={styles.subtitle}>
              Kakushadze &amp; Serur (2018) · <em>151 Trading Strategies</em>
            </div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <aside className={styles.toc} aria-label="Índice" ref={tocRef}>
            {SECTIONS.map((g) => (
              <div key={g.group} className={styles.tocGroup}>
                <div className={styles.tocGroupTitle}>{g.group}</div>
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    data-toc-id={it.id}
                    className={`${styles.tocItem} ${
                      it.id === activeId ? styles.tocItemActive : ''
                    }`}
                    onClick={() => handleNav(it.id)}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          <article className={styles.content} ref={contentRef}>
            {allItems.map((it) => (
              <section
                key={it.id}
                id={`manual-${it.id}`}
                className={styles.entry}
              >
                <header className={styles.entryHead}>
                  <h3 className={styles.entryTitle}>{it.label}</h3>
                  <span className={styles.entryRef}>{it.paperRef}</span>
                </header>

                <div className={styles.block}>
                  <div className={styles.blockLbl}>QUÉ HACE</div>
                  <p className={styles.prose}>{it.what}</p>
                </div>

                <div className={styles.block}>
                  <div className={styles.blockLbl}>FÓRMULA</div>
                  <pre className={styles.formula}>
                    {it.formula.join('\n')}
                  </pre>
                </div>

                <div className={styles.block}>
                  <div className={styles.blockLbl}>CÓMO INTERPRETAR</div>
                  <p className={styles.prose}>{it.interpret}</p>
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </>
  )
}
