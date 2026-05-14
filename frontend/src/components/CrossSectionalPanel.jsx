import { useEffect, useState } from 'react'
import { useCrossStrategy } from '../hooks/useCrossStrategy'
import { useAllTickers } from '../hooks/useTickers'
import TickerPicker from './TickerPicker'
import { fmt, signalColor, signalGlyph } from '../lib/format'
import styles from './CrossSectionalPanel.module.css'

/*
 * CrossSectionalPanel — sección para ejecutar estrategias cross-sectional
 * (que rankean tickers entre sí, en vez de generar signal per-ticker).
 *
 * Diseño: tabs arriba (una por estrategia), abajo el form de params
 * + tabla de resultados con ranking, decile y signal por ticker.
 *
 * Por ahora soporta solo PRICE_MOMENTUM. El patrón se replica para las
 * próximas (low_vol, value, multifactor, pairs, mr).
 */

const STRATS = [
  {
    id: 'momentum',
    label: 'PRICE MOMENTUM',
    description: 'Rankea tickers por cumulative return en el período de formación, skippeando el último mes para evitar short-term reversal.',
    paperRef: 'paper #1',
  },
  {
    id: 'low_volatility',
    label: 'LOW VOL',
    description: 'Anomaly: portfolios de baja volatilidad tienden a outperformar en el largo plazo. Rankea ASC por vol realizada — top decile = LONG (baja vol).',
    paperRef: 'paper #4',
  },
  // Próximas en commits siguientes:
  // { id: 'value', ... },
  // { id: 'multifactor', ... },
  // { id: 'pairs', ... },
  // { id: 'mr_single', ... },
  // { id: 'mr_multiple', ... },
]

export default function CrossSectionalPanel({ availableTickers = [] }) {
  const [activeId, setActiveId] = useState('momentum')
  const active = STRATS.find((s) => s.id === activeId) ?? STRATS[0]

  const { data: allTickers } = useAllTickers()
  const [selectedTickers, setSelectedTickers] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // Default: todos los del dashboard
  useEffect(() => {
    if (selectedTickers.length === 0 && availableTickers.length > 0) {
      setSelectedTickers(availableTickers.map((t) => t.ticker))
    }
  }, [availableTickers]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={styles.box}>
      <header className={styles.head}>
        <div>
          <div className={styles.eyebrow}>CROSS-SECTIONAL STRATEGIES</div>
          <div className={styles.title}>RANKING ENTRE TICKERS</div>
        </div>
        <button
          type="button"
          className={styles.cog}
          onClick={() => setPickerOpen(true)}
          title="Configurar universo de tickers"
        >
          ⚙ {selectedTickers.length} TICKERS
        </button>
      </header>

      <div className={styles.tabs}>
        {STRATS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.tab} ${s.id === activeId ? styles.tabActive : ''}`}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.activeDesc}>
          <span className={styles.paperRef}>{active.paperRef}</span>
          {active.description}
        </div>

        {activeId === 'momentum' && (
          <PriceMomentumRunner
            tickers={selectedTickers}
            availableTickers={availableTickers}
          />
        )}
        {activeId === 'low_volatility' && (
          <LowVolatilityRunner
            tickers={selectedTickers}
            availableTickers={availableTickers}
          />
        )}
      </div>

      <TickerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        allTickers={availableTickers.length > 0 ? availableTickers : (allTickers ?? [])}
        selected={selectedTickers}
        onChange={setSelectedTickers}
      />
    </section>
  )
}


// ============================================
// Sub-component: Price Momentum runner
// ============================================
function PriceMomentumRunner({ tickers }) {
  const { data, loading, error, run } = useCrossStrategy('momentum')
  const [formationDays, setFormationDays] = useState(126)
  const [skipDays, setSkipDays] = useState(21)
  const [riskAdjusted, setRiskAdjusted] = useState(false)

  const handleRun = (e) => {
    e.preventDefault()
    if (tickers.length < 2) return
    run({
      tickers,
      formation_days: formationDays,
      skip_days: skipDays,
      risk_adjusted: riskAdjusted,
    })
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleRun}>
        <div className={styles.field}>
          <label className={styles.lbl}>
            FORMATION (días) <span className={styles.bounds}>[21 — 504]</span>
          </label>
          <input
            type="number"
            min={21}
            max={504}
            step={1}
            value={formationDays}
            onChange={(e) => setFormationDays(parseInt(e.target.value, 10))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.lbl}>
            SKIP (días) <span className={styles.bounds}>[0 — 63]</span>
          </label>
          <input
            type="number"
            min={0}
            max={63}
            step={1}
            value={skipDays}
            onChange={(e) => setSkipDays(parseInt(e.target.value, 10))}
          />
        </div>
        <div className={`${styles.field} ${styles.switchField}`}>
          <label className={styles.lbl}>RISK ADJUSTED</label>
          <button
            type="button"
            role="switch"
            aria-checked={riskAdjusted}
            className={`${styles.switch} ${riskAdjusted ? styles.switchOn : ''}`}
            onClick={() => setRiskAdjusted((v) => !v)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
        <button
          type="submit"
          className={styles.submit}
          disabled={loading || tickers.length < 2}
        >
          {loading ? 'CALCULANDO…' : 'RANKEAR'}
        </button>
      </form>

      {tickers.length < 2 && (
        <div className={styles.warning}>
          Seleccioná al menos 2 tickers para rankear.
        </div>
      )}

      {error && (
        <div className={styles.error}>{String(error.message ?? error)}</div>
      )}

      {data && <RankingTable data={data} />}
    </>
  )
}


// ============================================
// Sub-component: Low Volatility runner
// ============================================
function LowVolatilityRunner({ tickers }) {
  const { data, loading, error, run } = useCrossStrategy('low_volatility')
  const [lookback, setLookback] = useState(126)
  const [annualized, setAnnualized] = useState(true)

  const handleRun = (e) => {
    e.preventDefault()
    if (tickers.length < 2) return
    run({
      tickers,
      lookback_days: lookback,
      annualized,
    })
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleRun}>
        <div className={styles.field}>
          <label className={styles.lbl}>
            LOOKBACK (días) <span className={styles.bounds}>[21 — 504]</span>
          </label>
          <input
            type="number"
            min={21}
            max={504}
            step={1}
            value={lookback}
            onChange={(e) => setLookback(parseInt(e.target.value, 10))}
          />
        </div>
        <div className={`${styles.field} ${styles.switchField}`}>
          <label className={styles.lbl}>ANUALIZADA (×√252)</label>
          <button
            type="button"
            role="switch"
            aria-checked={annualized}
            className={`${styles.switch} ${annualized ? styles.switchOn : ''}`}
            onClick={() => setAnnualized((v) => !v)}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>
        <div /> {/* spacer en la grid 3 cols */}
        <button
          type="submit"
          className={styles.submit}
          disabled={loading || tickers.length < 2}
        >
          {loading ? 'CALCULANDO…' : 'RANKEAR'}
        </button>
      </form>

      {tickers.length < 2 && (
        <div className={styles.warning}>Seleccioná al menos 2 tickers.</div>
      )}
      {error && <div className={styles.error}>{String(error.message ?? error)}</div>}
      {data && <RankingTable data={data} />}
    </>
  )
}


// ============================================
// Tabla de resultados — reusable para todas las cross strategies
// ============================================
function RankingTable({ data }) {
  return (
    <div className={styles.result}>
      <div className={styles.resultMeta}>
        <span>{data.n_tickers} tickers rankeados</span>
        {data.n_skipped > 0 && (
          <span className={styles.muted}> · {data.n_skipped} sin data suficiente</span>
        )}
        <span className={styles.muted}> · ts {fmt.ts(data.timestamp)}</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>RANK</th>
              <th>TICKER</th>
              <th className={styles.numCol}>FACTOR</th>
              <th>DECILE</th>
              <th>SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr
                key={it.ticker}
                style={{ '--row-color': signalColor(it.signal) }}
                className={it.factor_value == null ? styles.rowSkipped : ''}
              >
                <td className="tabular">{it.rank ?? '—'}</td>
                <td className={styles.tickerCell}>{it.ticker}</td>
                <td className={`${styles.numCol} tabular`}>
                  {it.factor_value == null ? '—' : fmt.pct(it.factor_value)}
                </td>
                <td className="tabular">{it.decile ?? '—'}</td>
                <td className={styles.signalCell}>
                  <span style={{ color: signalColor(it.signal) }}>
                    {signalGlyph(it.signal)} {it.signal}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
