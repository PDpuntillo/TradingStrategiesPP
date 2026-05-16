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
        paperRef: 'Estrategia #11',
        what:
          'La estrategia más simple de trend-following. Calcula el promedio de los últimos N precios de cierre y lo compara contra el precio actual. La media móvil suaviza el ruido del mercado y revela la dirección dominante de la tendencia: si el precio está por encima de la media, el mercado viene subiendo en promedio sobre esa ventana → momentum alcista. Si está por debajo, es lo contrario.',
        formula: [
          'SMA(N) = (1/N) · Σ Closeₜ₋ᵢ   para i = 0..N-1',
          '',
          'signal = LONG   si Close > SMA(N)',
          'signal = SHORT  si Close < SMA(N)',
          'signal = NEUTRAL si están dentro del threshold ε',
        ],
        interpret:
          'Funciona muy bien en mercados con tendencias claras y prolongadas (rallies o bear markets sostenidos). En mercados laterales o "choppy" genera muchos falsos cruces ("whipsaws") donde el precio rebota constantemente alrededor de la media, disparando entradas/salidas que pierden plata por comisiones y slippage. N grande = menos ruido pero más lag; N chico = más sensible pero más falsas señales.',
        example:
          'YPF.BA cotiza a $65,300 y la SMA(20) está en $64,036. El precio está 2% por encima de la media → LONG. Si en las próximas ruedas YPF baja a $63,500 con la SMA(20) ahora en $63,800, el signal flipea a SHORT.',
      },
      {
        id: 'dma',
        label: 'DMA — Dual Moving Average',
        paperRef: 'Estrategia #12',
        what:
          'Refina la idea del SMA usando DOS medias en vez de comparar contra el precio crudo. Una corta (rápida, captura el ritmo reciente) y una larga (lenta, captura la tendencia de fondo). El signal se dispara cuando la rápida cruza a la lenta — ese cruce significa que el momentum reciente cambió de signo respecto al promedio histórico. Le suma un stop-loss porcentual sobre el cierre anterior para no quedarte atrapado en un movimiento adverso brusco antes de que las medias respondan.',
        formula: [
          'SMA_fast = SMA(N_fast),   SMA_slow = SMA(N_slow)   (N_fast < N_slow)',
          '',
          'signal = LONG   si SMA_fast > SMA_slow',
          'signal = SHORT  si SMA_fast < SMA_slow',
        ],
        interpret:
          'Las combinaciones más conocidas son 20/50 (entradas tempranas, más sensible) y 50/200 (los famosos "golden cross" / "death cross", entradas tardías pero más confiables). El stop-loss del 2% es agresivo — útil en activos volátiles o en crisis (las medias móviles tienen lag y un crash puede vaciarte la cuenta antes de que la corta cruce a la larga).',
        example:
          'GGAL.BA con SMA(10)=$6,250 y SMA(30)=$6,180 → la rápida está por encima → LONG. Si mañana abre en gap-down a $6,050 (caída del 3.2% vs cierre anterior $6,250), se dispara EXIT_LONG por el stop-loss del 2% sin esperar a que las medias se reordenen.',
      },
      {
        id: 'tma',
        label: 'TMA — Triple Moving Average',
        paperRef: 'Estrategia #13',
        what:
          'Generaliza el DMA a tres medias (rápida, media, lenta). Entrada cuando las tres están alineadas en la misma dirección (fast > mid > slow → LONG; fast < mid < slow → SHORT) — exige que la tendencia esté confirmada en tres horizontes temporales distintos, así reduce los falsos positivos del DMA. La salida es más sensible: cuando la rápida cruza a la intermedia (sin importar la larga), ya se sale de la posición — captura reversales temprano antes de esperar a que se desalineen las tres.',
        formula: [
          'SMA_fast > SMA_mid > SMA_slow   →   LONG',
          'SMA_fast < SMA_mid < SMA_slow   →   SHORT',
          'SMA_fast ≤ SMA_mid              →   EXIT_LONG',
          'SMA_fast ≥ SMA_mid              →   EXIT_SHORT',
        ],
        interpret:
          'Filtro estricto para entrar, salida temprana para preservar capital. La asimetría es deliberada: entrar exige confirmación múltiple (3 medias), salir solo necesita una grieta (2 medias). Es de las pocas estrategias del set que cuida más el riesgo que la ganancia. Combinación clásica: 10/20/50.',
        example:
          'PAMP.BA con SMA(3)=$1,820, SMA(10)=$1,805, SMA(21)=$1,780. Las tres alineadas (3 > 10 > 21) → LONG. Si SMA(3) baja a $1,795 (por debajo de SMA(10)=$1,805) → EXIT_LONG inmediato, incluso aunque SMA(21) siga subiendo. Saliste antes que el DMA tradicional, que esperaría a que también se desalineen las medias largas.',
      },
      {
        id: 'pivot',
        label: 'Pivot Points',
        paperRef: 'Estrategia #14',
        what:
          'Calcula niveles psicológicos de soporte (S) y resistencia (R) usando el high, low y close del día anterior. El "pivote" es el promedio de los tres — funciona como divisor entre zona alcista y bajista del día. R y S son rebotes calculados a partir del rango. Es la estrategia preferida por floor traders intradiarios: te da niveles concretos antes de la apertura.',
        formula: [
          'P  = (High + Low + Close) / 3',
          'R1 = 2P − Low      S1 = 2P − High',
          'R2 = P + (High−Low) S2 = P − (High−Low)',
          '',
          'signal = LONG   si Close > P',
          'signal = SHORT  si Close < P',
        ],
        interpret:
          'Útil como mapa de referencia: si el precio rompe R con volumen, breakout alcista probable; si rebota en S, mean-reversion al alza. La estrategia te dice LONG si el precio está sobre el pivote (sesgo intradiario alcista), SHORT si está debajo. EXIT cuando toca los extremos (R o S) — la idea es que esos niveles "atraen" el precio y rara vez se rompen sin pull-back.',
        example:
          'ALUA.BA ayer cerró con high=$745, low=$728, close=$740. Pivote = (745+728+740)/3 = $737.67. R = 2(737.67) − 728 = $747.33. S = 2(737.67) − 745 = $730.33. Hoy ALUA abre a $742 → por encima del pivote → LONG. Si llega a $747.50 (supera R) → EXIT_LONG. Si vuelve a $729 (toca S desde arriba) → EXIT_SHORT.',
      },
      {
        id: 'donchian',
        label: 'Donchian Channels',
        paperRef: 'Estrategia #15',
        what:
          'Construye un canal con el high máximo y el low mínimo de los últimos N períodos. Cuando el precio toca el techo del canal hay rechazo desde resistencia → SHORT; cuando toca el piso, rebote desde soporte → LONG. Es la base del legendario sistema "Turtle Traders" de Richard Dennis. Lógica de mean-reversion sobre los extremos del rango reciente.',
        formula: [
          'Upper(N) = max(Highₜ₋₁..ₜ₋ₙ)',
          'Lower(N) = min(Lowₜ₋₁..ₜ₋ₙ)',
          'Mid      = (Upper + Lower) / 2',
          '',
          'signal = LONG   si Close > Upper',
          'signal = SHORT  si Close < Lower',
        ],
        interpret:
          'N corto (10-20 ruedas) = canal angosto, signals frecuentes pero ruidosos. N largo (55+) = canal ancho, signals raros pero contundentes (típicos breakouts/breakdowns mayores). Usamos una tolerancia del 0.5% del ancho del canal para considerar "tocó la banda" — sin eso casi nunca dispararía signal en datos reales. Captura tendencias largas pero con drawdowns importantes en mercados sin trend.',
        example:
          'BMA.BA con canal N=20 → band_upper=$7,175, band_lower=$6,820 (ancho = $355, tolerancia = $1.78). Si BMA cotiza a $7,173 → dentro del rango de tolerancia al techo → SHORT (rebote esperado desde resistencia). Si cotiza a $6,822 → cerca del piso → LONG. Si está en $7,000 (centro) → HOLD, ningún extremo tocado.',
      },
    ],
  },
  {
    group: 'CROSS-SECTIONAL',
    items: [
      {
        id: 'momentum',
        label: 'Price Momentum',
        paperRef: 'Estrategia #1',
        what:
          'Anomalía cross-sectional descubierta por Jegadeesh & Titman (1993): los winners siguen ganando y los losers siguen perdiendo, al menos por algunos meses. Calcula el retorno acumulado de cada ticker en los últimos T meses dejando S meses de "skip" para evitar el efecto contrario de short-term reversal. Rankea descendente: top decile = LONG (ganadores recientes), bottom decile = SHORT (perdedores).',
        formula: [
          'r_i = (P_{t−skip} / P_{t−skip−lookback}) − 1',
          '',
          'top decile (mayor r_i)    →   LONG',
          'bottom decile (menor r_i) →   SHORT',
        ],
        interpret:
          'Es de las anomalías más robustas de la literatura financiera — funciona en casi todos los mercados y períodos estudiados. Performa bien en regímenes con tendencias claras y prolongadas. Sufre fuerte en "momentum crashes" tras crisis (Marzo 2009, Abril 2020), cuando los losers rebotan más fuerte que los winners. Lookback típico: 12 meses, skip 1 mes.',
        example:
          'Universo de 20 CEDEARs, lookback 252 ruedas. NVDA acumuló +85% y META +60% (top decile → LONG). En el mismo período, INTC perdió -25% y BIDU -30% (bottom decile → SHORT). La estrategia compra NVDA+META y shortea INTC+BIDU con pesos iguales. Si la rotación continúa el próximo mes, el portfolio gana sin importar para dónde vaya el mercado.',
      },
      {
        id: 'low_vol',
        label: 'Low Volatility',
        paperRef: 'Estrategia #4',
        what:
          'Anomalía que contradice la teoría clásica del CAPM: las acciones de baja volatilidad generan retornos similares o superiores a las de alta vol, ajustados por riesgo. Rankea cada ticker por la desviación estándar de sus retornos diarios sobre la ventana de lookback, ascendente: top decile (menor vol) = LONG, bottom decile (mayor vol) = SHORT.',
        formula: [
          'σ_i = std(retornos diarios de i en los últimos N días) · √252',
          '',
          'bottom decile (menor σ) →   LONG',
          'top decile (mayor σ)    →   SHORT',
        ],
        interpret:
          'Es la base de los populares ETFs "min-vol" (USMV, SPLV). Funciona porque los inversores institucionales tienen aversión extrema al riesgo y subponderan estructuralmente las acciones más volátiles, dejándolas baratas. Tiende a sobreexponerse a sectores defensivos (utilities, consumer staples, real estate). Cuidado con el régimen de tasas: low-vol stocks suelen ser sensibles a tasas largas.',
        example:
          'Universo de 30 acciones del Merval + CEDEARs. KO_CEDEAR tiene vol anualizada del 18%, JPM_CEDEAR del 22% (top decile → LONG). YPFD, GGAL y TSLA_CEDEAR con vols del 55-70% (bottom decile → SHORT). La estrategia construye un portfolio dollar-neutral: long defensivos / short de alta beta. Apuesta a capturar el spread de vol-anomaly durante meses.',
      },
      {
        id: 'value',
        label: 'Value — Book / Price',
        paperRef: 'Estrategia #3',
        what:
          'Factor clásico de Fama-French. El ratio B/P (valor contable por acción dividido por precio actual) mide qué tan "barata" está la acción respecto a sus activos contables. Rankea descendente: top decile (B/P alto = más barato) = LONG (cheap), bottom decile (B/P bajo = caro) = SHORT (expensive).',
        formula: [
          'B/P_i = BookValuePerShare_i / Price_i',
          '',
          'top decile (mayor B/P)    →   LONG  (cheap)',
          'bottom decile (menor B/P) →   SHORT (expensive)',
        ],
        interpret:
          'Funciona porque los inversores sobre-pagan por acciones "glamour" (alto crecimiento esperado) y subestiman a las "boring" pero rentables. Performa mal durante bull markets growth-driven (2010-2021 fue desastroso para value). Rebota fuerte en rotaciones value vs growth (2022).',
        example:
          'GGAL cotiza a $6,185 con BookValuePerShare = $4,800 → B/P = 0.78. BBAR cotiza a $3,200 con BVPS = $4,100 → B/P = 1.28 (más value). En un universo de 10 bancos LATAM, BBAR queda en el top decile → LONG; si NVDA_CEDEAR tiene B/P ≈ 0.05 (precio = 20x el book), está en el bottom → SHORT. La estrategia apuesta a que el spread de valuation se cierre por reversión histórica.',
      },
      {
        id: 'multifactor',
        label: 'Multifactor',
        paperRef: 'Estrategia #6',
        what:
          'Combina los tres rankings anteriores (momentum + low-vol + value) en un único score promedio. Para cada ticker, se normalizan los rangos de cada factor a [0,1] (0 = mejor) y se promedian. Luego se rankea ascendente por ese score combinado: top decile = LONG, bottom = SHORT. Es la práctica estándar en quant institucional.',
        formula: [
          'score_i = (rank_mom_i + rank_lowvol_i + rank_value_i) / 3',
          '',
          'top decile (menor score) →   LONG',
          'bottom decile (mayor)    →   SHORT',
        ],
        interpret:
          'Diversifica entre factores que tienen correlaciones bajas entre sí — cuando momentum tiene un mal año, value puede estar bien, y viceversa. Eso suaviza el equity curve del portfolio y reduce el drawdown máximo. Costo: el retorno esperado es el promedio de los factores, así que rara vez vas a tener un año excepcional pero tampoco uno desastroso.',
        example:
          'PAMP rankea 3/20 en momentum (muy top, normalizado a 0.10), 12/20 en low-vol (medio, 0.58), 5/20 en value (top, 0.21). Score combinado = (0.10 + 0.58 + 0.21) / 3 = 0.30 → ranking sólido, entra en top decile → LONG. Una acción que sea top-momentum pero bottom-value y bottom-vol probablemente termine en el medio del ranking combinado y no opera.',
      },
      {
        id: 'pairs',
        label: 'Pairs Trading',
        paperRef: 'Estrategia #8',
        what:
          'Estrategia market-neutral: dos tickers altamente correlacionados (ej. dos bancos del mismo país, o un ETF y su sector subyacente) deberían moverse en línea en el largo plazo. Cuando uno sobre-rinde respecto al promedio del par, se considera "rich" → SHORT; el otro está "cheap" → LONG. La diferencia se llama "spread" — se apuesta a que el spread reverte a su media histórica.',
        formula: [
          'log_ret_i,t = log(P_i,t / P_i,t−1)',
          'demeaned_i  = log_ret_i,t − mean(log_ret par, t)',
          'score_i     = Σ demeaned_i,t   (sobre lookback)',
          '',
          'score_i > 0  →   SHORT i   (overperformed → expected revert down)',
          'score_i < 0  →   LONG  i   (underperformed → expected revert up)',
        ],
        interpret:
          'La fortaleza es la dollar-neutralidad: la posición es indiferente al mercado general. Si las dos acciones bajan 10% juntas, no perdés (vas long en una, short en la otra). El riesgo es divergencia fundamental: si una empresa anuncia un escándalo o un earnings desastroso, el spread puede agrandarse en lugar de reverter. Funciona mejor con pares de correlation > 0.7 y de la misma industria.',
        example:
          'GGAL.BA y BMA.BA (dos bancos argentinos altamente correlacionados, ρ ≈ 0.85). En los últimos 60 días, GGAL +12% y BMA +6%. Promedio del par = +9%. GGAL está "rich" (+12% − 9% = +3% sobre el par) → SHORT. BMA está "cheap" (−3%) → LONG. Posición dollar-neutral: $5,000 long en BMA, $5,000 short en GGAL. Profit si el spread se cierra (sea porque GGAL baja, BMA sube, o ambos convergen).',
      },
      {
        id: 'mean_reversion',
        label: 'Mean Reversion',
        paperRef: 'Estrategia #9 / #10',
        what:
          'Generaliza el pairs trading a N tickers de un mismo cluster (sector, región, o "todos juntos"). Calcula el retorno medio del cluster sobre la ventana, identifica los outperformers y underperformers, y apuesta a que reviertan hacia la media. Los outperformers se shortean (estaban "rich"), los underperformers se longean (estaban "cheap"). Toggle "use clusters" agrupa por sector según tickers_meta.json (Estrategia #10); si no, usa un único cluster con todos (Estrategia #9).',
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
          'Más robusto que pairs por la diversificación: una sola acción con noticia idiosincrática (M&A, escándalo) no rompe la estrategia porque está promediada con 5+ otras. Clusters por sector reducen ruido entre industrias no relacionadas. Performa mejor en horizontes cortos (días-semanas) donde la reversion es más probable. Sufre cuando un ticker tiene drift fundamental persistente — no toda divergencia revierte.',
        example:
          'Cluster "Bancos Argentinos" = [GGAL, BMA, BBAR, SUPV]. Retornos últimos 30 días: GGAL +15%, BMA +5%, BBAR +3%, SUPV -2%. Media del cluster = +5.25%. Demeaned: GGAL +9.75% (rich → SHORT), BMA -0.25% (≈ media → HOLD), BBAR -2.25% (LONG), SUPV -7.25% (LONG fuerte). Repartís $10,000 según pesos proporcionales a |demeaned|. Si la rotación entre los 4 bancos se reequilibra el próximo mes, ganás sin importar lo que haga el Merval entero.',
      },
    ],
  },
  {
    group: 'PORTFOLIO',
    items: [
      {
        id: 'portfolio',
        label: 'Sharpe-Max Optimizer',
        paperRef: 'Estrategia #18',
        what:
          'Dado un universo de tickers, encuentra los pesos que maximizan el ratio de Sharpe del portfolio (retorno esperado por unidad de riesgo). Dos modos: long-only (default, w_i ≥ 0 y Σw_i = 1, resuelto numéricamente por SLSQP — el realista para el Merval donde no se puede shortear) y dollar-neutral (toggle ON, Σw_i = 0 permitiendo shorts, solución analítica de Markowitz — válido solo en mercados como USA con shortselling disponible).',
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
          'Es el punto tangente de la frontera eficiente de Markowitz — teóricamente óptimo. Pero es extremadamente sensible a errores en los retornos esperados (μ): pequeños cambios en las estimaciones pueden hacer flip-flop los pesos del portfolio entre meses. En la práctica institucional se combina con técnicas de shrinkage (Ledoit-Wolf) o restricciones de turnover. Lo usamos como baseline para comparar contra portfolios naïve (equal-weight, market-cap weighted). Sobre el toggle DOLLAR NEUTRAL: con OFF (default) corre en long-only real — los pesos son siempre ≥ 0 y suman 1, no genera shorts (modo realista para el mercado argentino). Con ON permite shorts y restringe que Σw = 0: la posición long total equivale en dólares a la short total, dando un portfolio market-neutral indiferente al movimiento del índice general — pero requiere shortselling disponible (USA, brokers internacionales).',
        example:
          'Universo = [YPF, GGAL, PAMP, KO_CEDEAR, AAPL_CEDEAR]. Lookback 60 días: retornos medios anualizados [0.18, 0.22, 0.15, 0.08, 0.30] y covarianza estimada de la matriz de retornos diarios. La optimización long-only devuelve pesos {YPF: 0.10, GGAL: 0.25, PAMP: 0.15, KO: 0.20, AAPL: 0.30} — todos positivos, suman 1. Sharpe portfolio = 1.45 (vs 0.95 si todos equal-weight). Para un total_investment de $100k → $30k en AAPL, $25k en GGAL, etc. Si activás DOLLAR NEUTRAL con el mismo universo, podrías ver {YPF: +0.40, AAPL: +0.30, GGAL: +0.10, PAMP: -0.20, KO: -0.60} — pesos que suman 0, esto significa shortear $60k de KO y $20k de PAMP para fondear $80k de longs en YPF + AAPL + GGAL.',
      },
    ],
  },
]

export default function StrategyManual({ open, onClose }) {
  const allItems = SECTIONS.flatMap((g) => g.items)
  const [activeId, setActiveId] = useState(allItems[0].id)
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false })
  const contentRef = useRef(null)
  const tocRef = useRef(null)

  // Indicador continuo: interpola entre las posiciones de los items del TOC
  // según el scroll del content area. Hookeado a rAF para que se mueva
  // perfectamente sincronizado con la rueda del mouse.
  useEffect(() => {
    if (!open) return
    const root = contentRef.current
    const toc = tocRef.current
    if (!root || !toc) return

    let rafId = null

    const tick = () => {
      rafId = null
      const cursor = root.scrollTop + 40 // pequeño offset para que active antes del top

      // Posiciones absolutas de cada sección dentro del content
      const items = allItems
        .map((it) => {
          const el = document.getElementById(`manual-${it.id}`)
          return el ? { id: it.id, top: el.offsetTop } : null
        })
        .filter(Boolean)
      if (items.length === 0) return

      // Encontrar la sección actual (la última cuyo top <= cursor)
      let i = items.length - 1
      for (let j = 0; j < items.length; j++) {
        if (items[j].top > cursor) {
          i = Math.max(0, j - 1)
          break
        }
      }
      const cur = items[i]
      const next = items[i + 1]
      // El último item puede tener su `top` más allá del scrollTop máximo
      // alcanzable (si su contenido es corto). Clampeamos el "target" al
      // cursor máximo para que frac llegue a 1 cuando estamos en el fondo.
      const maxCursor = root.scrollHeight - root.clientHeight + 40
      const frac = next
        ? Math.max(
            0,
            Math.min(
              1,
              (cursor - cur.top) /
                Math.max(1, Math.min(next.top, maxCursor) - cur.top),
            ),
          )
        : 0

      // activeId snapea al item más "cubierto" (>= 50% del tramo)
      const dominant = next && frac > 0.5 ? next.id : cur.id
      setActiveId((prev) => (prev === dominant ? prev : dominant))

      // Interpolar la posición del indicador entre los botones del TOC
      const curBtn = toc.querySelector(`[data-toc-id="${cur.id}"]`)
      if (!curBtn) return
      const nextBtn = next ? toc.querySelector(`[data-toc-id="${next.id}"]`) : null
      const curTop = curBtn.offsetTop
      const curHeight = curBtn.offsetHeight

      if (nextBtn) {
        const nTop = nextBtn.offsetTop
        const nHeight = nextBtn.offsetHeight
        const top = curTop + (nTop - curTop) * frac
        const height = curHeight + (nHeight - curHeight) * frac
        setIndicator({ top, height, visible: true })
      } else {
        setIndicator({ top: curTop, height: curHeight, visible: true })
      }
    }

    const onScroll = () => {
      if (rafId == null) rafId = requestAnimationFrame(tick)
    }

    // Inicializar inmediatamente y reaccionar a resize
    tick()
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sticky-follow: cuando activeId cambia, llevamos el item al viewport del TOC
  useEffect(() => {
    if (!open || !tocRef.current) return
    const btn = tocRef.current.querySelector(`[data-toc-id="${activeId}"]`)
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeId, open])

  if (!open) return null

  const handleNav = (id) => {
    const el = document.getElementById(`manual-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    // el rAF del scroll listener se encarga de mover el indicador y activeId
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
            <div
              className={styles.tocIndicator}
              aria-hidden
              style={{
                transform: `translateY(${indicator.top}px)`,
                height: `${indicator.height}px`,
                opacity: indicator.visible ? 1 : 0,
              }}
            />
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

                {it.example && (
                  <div className={styles.block}>
                    <div className={styles.blockLbl}>EJEMPLO APLICADO</div>
                    <p className={styles.prose}>{it.example}</p>
                  </div>
                )}
              </section>
            ))}
          </article>
        </div>
      </div>
    </>
  )
}
