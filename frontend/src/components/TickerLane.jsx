import { useTickerData } from '../hooks/useTickerData'
import { useSignals } from '../hooks/useSignals'
import ConsensusRail from './ConsensusRail'
import ChartPanel from './ChartPanel'
import { fmt, signalColor } from '../lib/format'
import styles from './TickerLane.module.css'

/*
 * TickerLane — la franja horizontal por ticker.
 * Layout: [consensus rail (con todas las strategies)] · [chart]
 * Header pequeño arriba con price + delta.
 *
 * El SignalsStrip de la derecha se eliminó en favor del rail unificado:
 * cada row del rail ya muestra signal + valor de referencia + precio.
 */
export default function TickerLane({ ticker, tickerName, onOpenStrategy }) {
  const { data: bars, loading: barsLoading, error: barsError } = useTickerData(ticker)
  const { data: signals, loading: sigLoading, error: sigError } = useSignals(ticker)

  const lastBar = bars?.bars?.[bars.bars.length - 1]
  const prevBar = bars?.bars?.[bars.bars.length - 2]
  const last = lastBar?.close
  const prev = prevBar?.close
  const delta = last && prev ? (last - prev) / prev : null

  return (
    <article className={styles.lane}>
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
          signals={signals}
          consensus={signals?.consensus_signal}
          loading={sigLoading}
          onSegmentClick={(n) => onOpenStrategy?.(ticker, n)}
        />
        <ChartPanel data={bars} signals={signals} loading={barsLoading} />
      </div>
    </article>
  )
}
