import { useState } from 'react'
import { useTickerData } from '../hooks/useTickerData'
import { useSignals } from '../hooks/useSignals'
import ConsensusRail from './ConsensusRail'
import ChartPanel from './ChartPanel'
import StrategySelector from './StrategySelector'
import { fmt, signalColor } from '../lib/format'
import styles from './TickerLane.module.css'

/*
 * TickerLane — la franja horizontal por ticker.
 * Layout: [consensus rail] · [chart]
 *
 * El drawer del StrategySelector vive DENTRO de la lane (no a nivel
 * Dashboard) — sale como overlay desde el borde izquierdo de la lane,
 * con su misma altura y sin oscurecer el resto de la página. Cada
 * lane abre el suyo independiente.
 */
export default function TickerLane({ ticker, tickerName }) {
  const { data: bars, loading: barsLoading, error: barsError } = useTickerData(ticker)
  const { data: signals, loading: sigLoading, error: sigError } = useSignals(ticker)

  // Drawer state local a la lane
  const [strategyDrawer, setStrategyDrawer] = useState({ open: false, num: null })
  const openStrategy = (n) => setStrategyDrawer({ open: true, num: n })
  const closeStrategy = () => setStrategyDrawer((d) => ({ ...d, open: false }))

  const lastBar = bars?.bars?.[bars.bars.length - 1]
  const prevBar = bars?.bars?.[bars.bars.length - 2]
  const last = lastBar?.close
  const prev = prevBar?.close
  const delta = last && prev ? (last - prev) / prev : null

  return (
    <article id={`lane-${ticker}`} className={styles.lane}>
      <header className={styles.head}>
        <span className={styles.ticker} title={tickerName}>{ticker}.BA</span>
        <span className={`${styles.price} tabular`}>{fmt.price(last)}</span>
        <span
          className={`${styles.delta} tabular`}
          style={{ color: delta == null ? 'var(--fg-muted)' : delta >= 0 ? 'var(--sig-long)' : 'var(--sig-short)' }}
        >
          {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${fmt.pct(delta)}`}
        </span>
        <span className={styles.bars}>
          {bars?.bars?.length ?? '—'} BARS
        </span>
        {signals?.consensus_signal && (
          <span
            className={styles.headConsensus}
            style={{ color: signalColor(signals.consensus_signal) }}
          >
            ⏵ {signals.consensus_signal}
          </span>
        )}
        {(barsError || sigError) && (
          <span className={styles.err}>
            {barsError ? `data: ${barsError.message}` : `signals: ${sigError.message}`}
          </span>
        )}
      </header>

      <div className={styles.body}>
        <ConsensusRail
          ticker={ticker}
          signals={signals}
          consensus={signals?.consensus_signal}
          loading={sigLoading}
          onSegmentClick={openStrategy}
        />
        <ChartPanel ticker={ticker} data={bars} signals={signals} loading={barsLoading} />

        {/* Drawer contextual a la lane — overlay absoluto, sin backdrop */}
        <StrategySelector
          open={strategyDrawer.open}
          ticker={ticker}
          strategyNum={strategyDrawer.num}
          onClose={closeStrategy}
        />
      </div>
    </article>
  )
}
