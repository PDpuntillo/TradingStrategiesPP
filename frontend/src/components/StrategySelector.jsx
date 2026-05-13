import { useEffect, useState } from 'react'
import { useStrategy } from '../hooks/useStrategy'
import { fmt, signalColor } from '../lib/format'
import styles from './StrategySelector.module.css'

/*
 * StrategySelector — drawer lateral derecho que se abre al clickear
 * un segmento del consensus rail o una row del signals strip.
 * Permite ajustar params y re-correr la estrategia.
 */

// Params por estrategia (defaults + bounds del backend)
const PARAM_DEFS = {
  11: [
    { key: 'ma_period', label: 'MA Period', type: 'int', def: 20, min: 2, max: 200 },
    { key: 'ma_type', label: 'MA Type', type: 'select', def: 'SMA', options: ['SMA', 'EMA'] },
  ],
  12: [
    { key: 'ma_short_period', label: 'MA Short', type: 'int', def: 10, min: 2, max: 50 },
    { key: 'ma_long_period', label: 'MA Long', type: 'int', def: 30, min: 10, max: 200 },
    { key: 'stop_loss_pct', label: 'Stop Loss', type: 'float', def: 0.02, min: 0.001, max: 0.1, step: 0.001 },
  ],
  13: [
    { key: 'ma1_period', label: 'MA1 (fast)', type: 'int', def: 3, min: 2, max: 20 },
    { key: 'ma2_period', label: 'MA2 (mid)', type: 'int', def: 10, min: 5, max: 50 },
    { key: 'ma3_period', label: 'MA3 (slow)', type: 'int', def: 21, min: 10, max: 200 },
  ],
  14: [],
  15: [
    { key: 'channel_period', label: 'Channel Period', type: 'int', def: 20, min: 5, max: 100 },
  ],
}

const STRAT_NAMES = {
  11: 'Single Moving Average',
  12: 'Two MAs + Stop-Loss',
  13: 'Three MAs Filter',
  14: 'Pivot Points',
  15: 'Donchian Channel',
}

export default function StrategySelector({ open, strategyNum, ticker, onClose }) {
  const { data, loading, error, run } = useStrategy(strategyNum)
  const defs = PARAM_DEFS[strategyNum] ?? []
  const [params, setParams] = useState({})

  // Reset params al cambiar strategy
  useEffect(() => {
    const init = { ticker }
    defs.forEach((d) => { init[d.key] = d.def })
    setParams(init)
  }, [strategyNum, ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = (e) => {
    e.preventDefault()
    run(params)
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <aside className={styles.drawer} role="dialog" aria-label={`Strategy ${strategyNum}`}>
        <header className={styles.head}>
          <div>
            <div className={styles.sNum}>STRATEGY {strategyNum}</div>
            <div className={styles.sName}>{STRAT_NAMES[strategyNum]}</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.context}>
          <span className={styles.ctxLbl}>TICKER</span>
          <span className={styles.ctxVal}>{ticker}.BA</span>
        </div>

        <form className={styles.form} onSubmit={handleRun}>
          <div className={styles.formHead}>PARÁMETROS</div>

          {defs.length === 0 && (
            <div className={styles.noParams}>Esta estrategia no acepta parámetros.</div>
          )}

          {defs.map((d) => (
            <div key={d.key} className={styles.field}>
              <label htmlFor={d.key} className={styles.label}>
                {d.label} <span className={styles.bounds}>[{d.min}—{d.max}]</span>
              </label>
              {d.type === 'select' ? (
                <select
                  id={d.key}
                  value={params[d.key] ?? d.def}
                  onChange={(e) => setParams({ ...params, [d.key]: e.target.value })}
                >
                  {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  id={d.key}
                  type="number"
                  min={d.min}
                  max={d.max}
                  step={d.step ?? (d.type === 'float' ? 0.01 : 1)}
                  value={params[d.key] ?? d.def}
                  onChange={(e) => setParams({
                    ...params,
                    [d.key]: d.type === 'int' ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
                  })}
                />
              )}
            </div>
          ))}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'EJECUTANDO…' : 'EJECUTAR'}
          </button>
        </form>

        {error && (
          <div className={styles.error}>{String(error.message ?? error)}</div>
        )}

        {data && (
          <div className={styles.result}>
            <div className={styles.resultHead}>RESULTADO</div>
            <div className={styles.resRow}>
              <span className={styles.resLbl}>SIGNAL</span>
              <span className={styles.resVal} style={{ color: signalColor(data.signal) }}>
                {data.signal}
              </span>
            </div>
            <div className={styles.resRow}>
              <span className={styles.resLbl}>PRICE</span>
              <span className={`${styles.resVal} tabular`}>{fmt.price(data.current_price)}</span>
            </div>
            {Object.entries(data).map(([k, v]) => {
              if (['ticker', 'timestamp', 'signal', 'current_price'].includes(k)) return null
              if (typeof v === 'object' || v === null) return null
              return (
                <div key={k} className={styles.resRow}>
                  <span className={styles.resLbl}>{k.toUpperCase()}</span>
                  <span className={`${styles.resVal} tabular`}>
                    {typeof v === 'number' ? fmt.price(v) : String(v)}
                  </span>
                </div>
              )
            })}
            <div className={styles.resFoot}>{fmt.ts(data.timestamp)}</div>
          </div>
        )}
      </aside>
    </>
  )
}
