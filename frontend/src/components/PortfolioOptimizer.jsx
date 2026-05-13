import { useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'
import { fmt } from '../lib/format'
import styles from './PortfolioOptimizer.module.css'

const TICKERS = ['GGAL', 'YPF', 'PAMP']

/*
 * PortfolioOptimizer — strategy 18, Sharpe maximization.
 * Bars horizontales, una por ticker, ancho = abs(weight).
 * Pesos negativos (cuando dollar_neutral=true) se pintan en oxblood.
 */
export default function PortfolioOptimizer() {
  const { data, loading, error, optimize } = usePortfolio()
  const [lookback, setLookback] = useState(252)
  const [dollarNeutral, setDollarNeutral] = useState(false)
  const [investment, setInvestment] = useState(100000)

  const handleRun = (e) => {
    e.preventDefault()
    optimize({
      tickers: TICKERS,
      lookback_days: lookback,
      dollar_neutral: dollarNeutral,
      total_investment: investment,
    })
  }

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
      </header>

      <form className={styles.form} onSubmit={handleRun}>
        <div className={styles.field}>
          <label className={styles.lbl}>LOOKBACK (días)</label>
          <input
            type="number"
            min={30}
            max={1000}
            value={lookback}
            onChange={(e) => setLookback(parseInt(e.target.value, 10))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.lbl}>INVERSIÓN TOTAL</label>
          <input
            type="number"
            min={1}
            step={1000}
            value={investment}
            onChange={(e) => setInvestment(parseFloat(e.target.value))}
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

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'OPTIMIZANDO…' : 'OPTIMIZAR'}
        </button>
      </form>

      {error && (
        <div className={styles.error}>{String(error.message ?? error)}</div>
      )}

      {data && (
        <div className={styles.result}>
          {/* Stats top */}
          <div className={styles.stats}>
            <Stat label="SHARPE" value={fmt.ratio(data.sharpe_ratio)} accent />
            <Stat label="RETURN" value={fmt.pct(data.portfolio_return)} />
            <Stat label="VOL" value={fmt.pct(data.portfolio_volatility)} />
            <Stat label="MODE" value={data.dollar_neutral ? 'NEUTRAL' : 'LONG-ONLY'} />
          </div>

          {/* Bars */}
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
