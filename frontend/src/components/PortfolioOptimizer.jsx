import { useEffect, useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'
import { useAllTickers } from '../hooks/useTickers'
import TickerPicker from './TickerPicker'
import { fmt } from '../lib/format'
import styles from './PortfolioOptimizer.module.css'

/*
 * PortfolioOptimizer — strategy 18, Sharpe maximization.
 *
 * La selección de tickers es independiente del dashboard:
 * - Default: los disponibles en el dashboard (props.availableTickers)
 * - Editable via cog → modal TickerPicker (busca en la master list /tickers/all,
 *   filtrada a los que tienen sheet_id)
 *
 * Lookback default 504d (~2 años) — la covarianza Sharpe-max es mucho
 * más estable con ventana larga.
 *
 * El min de inversión lo valida el backend (devuelve 400 si no hay datos
 * suficientes); del lado UI solo gateamos por count de tickers >= 2.
 */
export default function PortfolioOptimizer({ availableTickers = [] }) {
  const { data, loading, error, optimize } = usePortfolio()
  const { data: allTickers } = useAllTickers()

  const [selectedTickers, setSelectedTickers] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // Sync inicial: arrancar con todos los del dashboard (los que tienen sheet)
  useEffect(() => {
    if (selectedTickers.length === 0 && availableTickers.length > 0) {
      setSelectedTickers(availableTickers.map((t) => t.ticker))
    }
  }, [availableTickers]) // eslint-disable-line react-hooks/exhaustive-deps

  const [lookback, setLookback] = useState(504)
  const [dollarNeutral, setDollarNeutral] = useState(false)
  const [investment, setInvestment] = useState(100000)

  const tooFewTickers = selectedTickers.length < 2

  const handleRun = (e) => {
    e.preventDefault()
    if (tooFewTickers) return
    optimize({
      tickers: selectedTickers,
      lookback_days: lookback,
      dollar_neutral: dollarNeutral,
      total_investment: investment,
    })
  }

  // El picker filtra por los que tienen sheet configurado (no toda la lista).
  // Eso es lo que devuelve /api/tickers/all? No — eso da TODOS. Para el picker
  // del optimizer queremos solo los disponibles, no los que aún no se crearon.
  // Como availableTickers ya viene filtrado, lo usamos.
  const pickerOptions = availableTickers.length > 0 ? availableTickers : (allTickers ?? [])

  const maxAbsWeight = data?.weights
    ? Math.max(...data.weights.map((w) => Math.abs(w.weight)), 0.0001)
    : 1

  return (
    <section className={styles.box}>
      <header className={styles.head}>
        <div>
          <div className={styles.eyebrow}>STRATEGY 18</div>
          <div className={styles.title}>PORTFOLIO OPTIMIZATION · SHARPE MAX</div>
        </div>
        <button
          type="button"
          className={styles.cog}
          onClick={() => setPickerOpen(true)}
          title="Configurar tickers"
        >
          ⚙ {selectedTickers.length} TICKERS
        </button>
      </header>

      {tooFewTickers && (
        <div className={styles.warning}>
          Seleccioná al menos 2 tickers para optimizar.
        </div>
      )}

      <form className={styles.form} onSubmit={handleRun}>
        <div className={styles.field}>
          <label className={styles.lbl}>
            LOOKBACK (días)
            <span className={styles.bounds}>[30 — 1260]</span>
          </label>
          <input
            type="number"
            min={30}
            max={1260}
            step={1}
            value={lookback}
            onChange={(e) => setLookback(parseInt(e.target.value, 10))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.lbl}>
            INVERSIÓN TOTAL
            <span className={styles.bounds}>[sin máx]</span>
          </label>
          <input
            type="number"
            min={1}
            step="any"
            value={investment}
            onChange={(e) => setInvestment(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div className={`${styles.field} ${styles.switchField}`}>
          <label className={styles.lbl}>DOLLAR NEUTRAL</label>
          <button
            type="button"
            role="switch"
            aria-checked={dollarNeutral}
            className={`${styles.switch} ${dollarNeutral ? styles.switchOn : ''}`}
            onClick={() => setDollarNeutral((v) => !v)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>

        <button
          type="submit"
          className={styles.submit}
          disabled={loading || tooFewTickers}
        >
          {loading ? 'OPTIMIZANDO…' : 'OPTIMIZAR'}
        </button>
      </form>

      <TickerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        allTickers={pickerOptions}
        selected={selectedTickers}
        onChange={setSelectedTickers}
      />

      {error && (
        <div className={styles.error}>{String(error.message ?? error)}</div>
      )}

      {data && (
        <div className={styles.result}>
          <div className={styles.stats}>
            <Stat label="SHARPE" value={fmt.ratio(data.sharpe_ratio)} accent />
            <Stat label="RETURN" value={fmt.pct(data.portfolio_return)} />
            <Stat label="VOL" value={fmt.pct(data.portfolio_volatility)} />
            <Stat label="MODE" value={data.dollar_neutral ? 'NEUTRAL' : 'LONG-ONLY'} />
          </div>

          <div className={styles.bars}>
            {data.weights.map((w) => {
              const widthPct = (Math.abs(w.weight) / maxAbsWeight) * 100
              const isShort = w.weight < 0
              return (
                <div key={w.ticker} className={styles.barRow}>
                  <div className={styles.barTicker}>{w.ticker}.BA</div>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${isShort ? styles.barShort : ''}`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className={`${styles.barPct} tabular`}>{fmt.pct(w.weight)}</span>
                    </div>
                  </div>
                  <div className={`${styles.barDollar} tabular`}>
                    {fmt.price(w.dollar_position)}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.foot}>
            ts {fmt.ts(data.timestamp)} · total {fmt.price(data.total_investment)}
          </div>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLbl}>{label}</div>
      <div className={`${styles.statVal} ${accent ? styles.statAccent : ''} tabular`}>{value}</div>
    </div>
  )
}
