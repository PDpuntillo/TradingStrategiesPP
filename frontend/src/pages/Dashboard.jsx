import { useState } from 'react'
import Header from '../components/Header'
import TickerLane from '../components/TickerLane'
import PortfolioOptimizer from '../components/PortfolioOptimizer'
import StrategySelector from '../components/StrategySelector'
import styles from './Dashboard.module.css'

const TICKERS = ['GGAL', 'YPF', 'PAMP']

export default function Dashboard() {
  // Selección actual: para resaltar el ticker en el header (no filtra lanes,
  // las 3 lanes se muestran siempre — eso es la propuesta del producto).
  const [selectedTicker, setSelectedTicker] = useState('GGAL')

  // Drawer del strategy selector
  const [drawer, setDrawer] = useState({ open: false, ticker: null, strategyNum: null })

  const openStrategy = (ticker, n) => setDrawer({ open: true, ticker, strategyNum: n })
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }))

  return (
    <div className={styles.shell}>
      <Header
        selectedTicker={selectedTicker}
        onSelectTicker={setSelectedTicker}
        lastUpdated={new Date().toISOString()}
      />

      <main className={styles.main}>
        {TICKERS.map((t) => (
          <TickerLane key={t} ticker={t} onOpenStrategy={openStrategy} />
        ))}

        <PortfolioOptimizer />

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
