import { useState } from 'react'
import { fmt, signalColor, signalGlyph } from '../lib/format'
import { STRATEGY_REGISTRY, useEnabledStrategies } from '../hooks/useEnabledStrategies'
import { useStrategyParams, formatStrategyParams } from '../hooks/useStrategyParams'
import StrategyTogglePanel from './StrategyTogglePanel'
import styles from './ConsensusRail.module.css'

/*
 * ConsensusRail — SIGNATURE del producto, ahora unificado.
 *
 * Columna izquierda con TODAS las estrategias habilitadas. Cada row:
 *   [signal-stripe] S## · NAME · {↑↓—} · LONG/SHORT · ref · price
 *
 * Reemplaza la combinación rail-magro + signals-strip-derecha del
 * diseño anterior. Click en una row → abre drawer.
 *
 * Header con cog (⚙) → abre panel para toggle de estrategias activas.
 * Footer = consensus calculado solo sobre las estrategias habilitadas.
 */
export default function ConsensusRail({ ticker, signals, consensus, loading, onSegmentClick }) {
  const { enabled, toggle, enableAll, disableAll, reset } = useEnabledStrategies()
  const [panelOpen, setPanelOpen] = useState(false)

  const strats = STRATEGY_REGISTRY.filter((s) => enabled.includes(s.n))

  return (
    <div className={styles.rail} aria-label="Consensus rail">
      <header className={styles.head}>
        <span className={styles.headLabel}>STRATEGIES</span>
        <button
          type="button"
          className={styles.cog}
          onClick={() => setPanelOpen(true)}
          title="Activar / desactivar estrategias"
        >
          ⚙ {enabled.length}/{STRATEGY_REGISTRY.length}
        </button>
      </header>

      <div className={styles.rows}>
        {strats.length === 0 && (
          <div className={styles.empty}>
            sin estrategias activas — abrí ⚙ para habilitar
          </div>
        )}
        {strats.map((s) => (
          <RailRow
            key={s.n}
            ticker={ticker}
            registry={s}
            strategySignal={signals?.[`strategy_${s.n}`]}
            loading={loading}
            onClick={() => onSegmentClick?.(s.n)}
          />
        ))}
      </div>

      <div
        className={styles.consensus}
        style={{ '--seg-color': consensus ? signalColor(consensus) : 'var(--fg-muted)' }}
      >
        <span className={styles.consensusLabel}>CONSENSUS</span>
        <span className={styles.consensusValue}>{loading ? '...' : consensus ?? '—'}</span>
      </div>

      <StrategyTogglePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        enabled={enabled}
        onToggle={toggle}
        onEnableAll={enableAll}
        onDisableAll={disableAll}
        onReset={reset}
      />
    </div>
  )
}

/*
 * RailRow — una fila de estrategia. Se separa en un componente para
 * poder usar useStrategyParams(ticker, n) sin violar las reglas de hooks
 * (no se pueden usar en un .map en el padre).
 *
 * El chip gris bajo el nombre se renderiza desde los params LIVE de la
 * store, no de defaults estáticos, así si el usuario cambia MA Period
 * en el drawer a 50, acá ves "SMA · 50" inmediatamente.
 */
function RailRow({ ticker, registry, strategySignal, loading, onClick }) {
  const { n, name, short, refKey, refLbl } = registry
  const [params] = useStrategyParams(ticker, n)
  const paramsLabel = formatStrategyParams(n, params)

  const sig = loading ? null : strategySignal?.signal ?? null
  const refVal = strategySignal?.[refKey]
  const price = strategySignal?.current_price

  // Siempre clickeable — si el backend rechazó los params (ej. fuera de
  // rango), el usuario tiene que poder abrir el drawer para corregir o
  // hacer RESET. Solo bloqueamos el primer fetch en frío.
  const failed = !strategySignal && !loading
  return (
    <button
      className={`${styles.row} ${failed ? styles.rowFailed : ''}`}
      style={{ '--seg-color': sig ? signalColor(sig) : 'var(--bg-elev-3)' }}
      onClick={onClick}
      title={
        failed
          ? `Strategy ${n} — ${name} · sin resultado, abrí para revisar params`
          : `Strategy ${n} — ${name}`
      }
    >
      <span className={styles.rowNum}>S{n}</span>
      <span className={styles.rowNameBlock}>
        <span className={styles.rowName}>{short}</span>
        {paramsLabel && <span className={styles.rowParams}>{paramsLabel}</span>}
      </span>
      <span className={styles.rowGlyph} style={{ color: signalColor(sig) }}>
        {signalGlyph(sig)}
      </span>
      <span className={styles.rowSig} style={{ color: signalColor(sig) }}>
        {sig ?? '—'}
      </span>
      <span className={styles.rowMeta}>
        <span className={styles.metaLbl}>{refLbl}</span>
        <span className={`${styles.metaVal} tabular`}>{fmt.price(refVal)}</span>
      </span>
      <span className={styles.rowMeta}>
        <span className={styles.metaLbl}>PX</span>
        <span className={`${styles.metaVal} tabular`}>{fmt.price(price)}</span>
      </span>
    </button>
  )
}
