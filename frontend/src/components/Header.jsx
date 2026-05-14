import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import { api } from '../lib/api'
import AddTickerModal from './AddTickerModal'
import styles from './Header.module.css'

/*
 * Header — cinta superior tipo ticker tape.
 * Brand · tickers · timestamp · clear cache.
 *
 * Props:
 *   tickers: TickerInfo[] — la lista viene del Dashboard (useTickers hook)
 *   selectedTicker: string | null
 *   onSelectTicker: (ticker) => void
 *   lastUpdated: ISO string
 */
export default function Header({ tickers = [], selectedTicker, onSelectTicker, lastUpdated, onTickerAdded }) {
  const [clearing, setClearing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  // Tick cada 30s para refrescar el "ahora" del clock derecho
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const handleClear = async () => {
    setClearing(true)
    try {
      await api.clearCache()
    } finally {
      setClearing(false)
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
          <path
            d="M5 22 L11 14 L17 18 L27 8"
            stroke="var(--accent-amber)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="square"
          />
          <circle cx="27" cy="8" r="2" fill="var(--accent-amber)" />
        </svg>
        <span className={styles.brandName}>TRADINGSTRATEGYS</span>
        <span className={styles.brandSlash}>//</span>
        <span className={styles.brandSub}>PABLO · MERVAL</span>
      </div>

      <nav className={styles.tickers} aria-label="Tickers">
        {tickers.map((t) => (
          <button
            key={t.ticker}
            className={`${styles.tickerBtn} ${
              t.ticker === selectedTicker ? styles.tickerBtnActive : ''
            }`}
            onClick={() => onSelectTicker?.(t.ticker)}
            title={t.name}
          >
            {t.ticker}.BA
          </button>
        ))}
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setAddOpen(true)}
          title="Agregar ticker"
        >
          + ADD
        </button>
      </nav>

      <AddTickerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => onTickerAdded?.()}
      />

      <div className={styles.right}>
        <span className={styles.label}>last fetch</span>
        <span className={`${styles.value} tabular`}>{fmt.ts(lastUpdated)}</span>
        <span className={styles.divider} />
        <span className={styles.label}>now</span>
        <span className={`${styles.value} tabular`}>
          {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button className={styles.clearBtn} onClick={handleClear} disabled={clearing}>
          {clearing ? '...' : 'CLEAR CACHE'}
        </button>
      </div>
    </header>
  )
}
