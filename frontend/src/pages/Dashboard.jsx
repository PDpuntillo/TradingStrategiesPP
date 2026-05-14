import { useEffect, useState } from 'react'
import Header from '../components/Header'
import TickerLane from '../components/TickerLane'
import PortfolioOptimizer from '../components/PortfolioOptimizer'
import CrossSectionalPanel from '../components/CrossSectionalPanel'
import StrategySelector from '../components/StrategySelector'
import { useTickers } from '../hooks/useTickers'
import { useLaneConfig } from '../hooks/useLaneConfig'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  // Tickers disponibles (cargados del backend, dinámicos)
  const { data: tickers, loading: tickersLoading, error: tickersError, refetch: refetchTickers } = useTickers()

  // Visibilidad y orden de las lanes — persistido en localStorage
  const laneConfig = useLaneConfig(tickers ?? [])

  // Ticker seleccionado en header (visual, no filtra lanes)
  const [selectedTicker, setSelectedTicker] = useState(null)

  // Drawer del strategy selector
  const [drawer, setDrawer] = useState({ open: false, ticker: null, strategyNum: null })

  // Sync default selection con el primer ticker disponible
  useEffect(() => {
    if (!selectedTicker && tickers?.length) {
      setSelectedTicker(tickers[0].ticker)
    }
  }, [tickers, selectedTicker])

  const openStrategy = (ticker, n) => setDrawer({ open: true, ticker, strategyNum: n })
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }))

  return (
    <div className={styles.shell}>
      <Header
        tickers={tickers ?? []}
        selectedTicker={selectedTicker}
        onSelectTicker={setSelectedTicker}
        lastUpdated={new Date().toISOString()}
        onTickerAdded={refetchTickers}
        laneConfig={laneConfig}
      />

      <main className={styles.main}>
        {tickersLoading && (
          <div className={styles.message}>cargando tickers…</div>
        )}
        {tickersError && (
          <div className={styles.error}>error cargando tickers: {String(tickersError.message)}</div>
        )}
        {tickers?.length === 0 && !tickersLoading && (
          <div className={styles.message}>
            sin tickers configurados — agregá <code>SHEET_IDS_JSON</code> en el backend
          </div>
        )}

        {/* Solo renderear lanes visibles, en el orden custom del usuario */}
        {laneConfig.visibleOrdered.map((t) => (
          <TickerLane
            key={t.ticker}
            ticker={t.ticker}
            tickerName={t.name}
            onOpenStrategy={openStrategy}
          />
        ))}

        <PortfolioOptimizer availableTickers={tickers ?? []} />

        <CrossSectionalPanel availableTickers={tickers ?? []} />

        <footer className={styles.footer}>
          <span>Kakushadze & Serur (2018) · 151 Trading Strategies · #11–15, 18</span>
          <span>·</span>
          <span>Backend FastAPI · Sheets API Key · Vite + React</span>
        </footer>
      </main>

      <StrategySelector
        open={drawer.open}
        ticker={drawer.ticker}
        strategyNum={drawer.strategyNum}
        onClose={closeDrawer}
      />
    </div>
  )
}
