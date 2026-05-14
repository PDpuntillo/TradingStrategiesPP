import { STRATEGY_REGISTRY } from '../hooks/useEnabledStrategies'
import styles from './StrategyTogglePanel.module.css'

/*
 * Panel modal para activar/desactivar estrategias globalmente.
 * El estado se persiste en localStorage (ver useEnabledStrategies).
 *
 * Cuando se agreguen más estrategias del paper (16, 17, 19+), aparecen
 * acá automáticamente al sumarlas a STRATEGY_REGISTRY.
 */
export default function StrategyTogglePanel({
  open,
  onClose,
  enabled,
  onToggle,
  onEnableAll,
  onDisableAll,
  onReset,
}) {
  if (!open) return null

  return (
    <aside className={styles.panel} role="dialog" aria-label="Toggle strategies">
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>ESTRATEGIAS ACTIVAS</div>
            <div className={styles.title}>{enabled.length} de {STRATEGY_REGISTRY.length}</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.bulkBar}>
          <button className={styles.bulkBtn} onClick={onEnableAll}>todas</button>
          <button className={styles.bulkBtn} onClick={onDisableAll}>ninguna</button>
          <button className={styles.bulkBtn} onClick={onReset}>reset</button>
        </div>

        <div className={styles.list}>
          {STRATEGY_REGISTRY.map(({ n, name, short }) => {
            const isOn = enabled.includes(n)
            return (
              <button
                key={n}
                type="button"
                className={`${styles.row} ${isOn ? styles.rowOn : ''}`}
                onClick={() => onToggle(n)}
              >
                <span className={styles.check}>{isOn ? '■' : '□'}</span>
                <span className={styles.num}>S{n}</span>
                <span className={styles.short}>{short}</span>
                <span className={styles.name}>{name}</span>
              </button>
            )
          })}
        </div>

        <footer className={styles.foot}>
          <span className={styles.note}>
            Las estrategias deshabilitadas no se piden al backend ni cuentan
            en el consensus.
          </span>
        </footer>
    </aside>
  )
}
