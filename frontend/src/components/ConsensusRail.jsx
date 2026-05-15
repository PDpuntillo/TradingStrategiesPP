import { useState } from 'react'
import { fmt, signalColor, signalGlyph } from '../lib/format'
import { STRATEGY_REGISTRY, useEnabledStrategies } from '../hooks/useEnabledStrategies'
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
export default function ConsensusRail({ signals, consensus, loading, onSegmentClick }) {
  const { enabled, toggle, enableAll, disableAll, reset } = useEnabledStrategies()
  const [panelOpen, setPanelOpen] = useState(false)

  const strats = STRATEGY_REGISTRY.filter((s) => enabled.includes(s.n))

  const getSig = (n) => signals?.[`strategy_${n}`]?.signal ?? null
  const getStrat = (n) => signals?.[`strategy_${n}`]

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
        {strats.map(({ n, name, short, refKey, refLbl, params }) => {
          const sig = loading ? null : getSig(n)
          const s = getStrat(n)
          const refVal = s?.[refKey]
          const price = s?.current_price
          return (
            <button
              key={n}
              className={styles.row}
              style={{ '--seg-color': sig ? signalColor(sig) : 'var(--bg-elev-3)' }}
              onClick={() => onSegmentClick?.(n)}
              disabled={!s && !loading}
              title={`Strategy ${n} — ${name}`}
            >
              <span className={styles.rowNum}>S{n}</span>
              <span className={styles.rowNameBlock}>
                <span className={styles.rowName}>{short}</span>
                {params && <span className={styles.rowParams}>{params}</span>}
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
        })}
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
