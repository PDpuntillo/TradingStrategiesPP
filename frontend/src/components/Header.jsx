import { useEffect, useState } from 'react'
import { fmt } from '../lib/format'
import { api } from '../lib/api'
import AddTickerModal from './AddTickerModal'
import LaneConfigPanel from './LaneConfigPanel'
import styles from './Header.module.css'

/*
 * Header — OS X-style toolbar, sticky en el top de la página.
 *
 * Layout left → right:
 *   [brand] · [+ ADD] [⚙ N/M] · [TICKERS scrolleables → shortcut a lane] · [clock] [CLEAR CACHE]
 *
 * Las ticker pills funcionan como anclas: click hace scrollIntoView de
 * la lane correspondiente (id="lane-TICKER" en TickerLane).
 */
export default function Header({
  tickers = [],
  selectedTicker,
  onSelectTicker,
  lastUpdated,
  onTickerAdded,
  laneConfig,
}) {
  const [clearing, setClearing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [laneConfigOpen, setLaneConfigOpen] = useState(false)

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

  const handleTickerClick = (ticker) => {
    onSelectTicker?.(ticker)
    const el = document.getElementById(`lane-${ticker}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden>
          <path
            d="M5 22 L11 14 L17 18 L27 8"
            stroke="var(--accent-blue)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="square"
          />
          <circle cx="27" cy="8" r="2" fill="var(--accent-blue)" />
        </svg>
        <span className={styles.brandName}>TRADINGSTRATEGYS</span>
        <span className={styles.brandSlash}>//</span>
        <span className={styles.brandSub}>PABLO · MERVAL</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setAddOpen(true)}
          title="Agregar ticker"
        >
          + ADD
        </button>
        {laneConfig && (
          <button
            type="button"
            className={styles.cogBtn}
            onClick={() => setLaneConfigOpen(true)}
            title="Configurar lanes visibles y orden"
          >
            ⚙ {laneConfig.config.visible.length}/{laneConfig.config.order.length}
          </button>
        )}
      </div>

      {/* Scrollable ticker shortcuts — separados de actions */}
      <nav className={styles.tickerNav} aria-label="Tickers shortcuts">
        <div className={styles.tickers}>
          {tickers.map((t) => (
            <button
              key={t.ticker}
              className={`${styles.tickerBtn} ${
                t.ticker === selectedTicker ? styles.tickerBtnActive : ''
              }`}
              onClick={() => handleTickerClick(t.ticker)}
              title={`Ir a ${t.name}`}
            >
              {t.ticker}.BA
            </button>
          ))}
        </div>
      </nav>

      <div className={styles.right}>
        <span className={styles.label}>NOW</span>
        <span className={`${styles.value} tabular`}>
          {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button className={styles.clearBtn} onClick={handleClear} disabled={clearing}>
          {clearing ? '...' : 'CLEAR CACHE'}
        </button>
      </div>

      <AddTickerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => onTickerAdded?.()}
      />

      {laneConfig && (
        <LaneConfigPanel
          open={laneConfigOpen}
          onClose={() => setLaneConfigOpen(false)}
          availableTickers={tickers}
          config={laneConfig.config}
          onToggle={laneConfig.toggleVisible}
          onShowAll={laneConfig.showAll}
          onHideAll={laneConfig.hideAll}
          onMove={laneConfig.moveTicker}
          onReset={laneConfig.resetOrder}
        />
      )}
    </header>
  )
}
