import { useState } from 'react'
import styles from './LaneConfigPanel.module.css'

/*
 * LaneConfigPanel — modal para configurar qué tickers se ven y en qué orden.
 *
 * Visibilidad: checkbox por ticker (toggle).
 * Orden: drag-and-drop. Cada row tiene un drag handle (≡) y es draggable.
 *
 * Props:
 *   open, onClose
 *   availableTickers: TickerInfo[] del backend
 *   config: { visible: string[], order: string[] }
 *   onToggle, onShowAll, onHideAll, onMove(ticker, toIdx), onReset
 */
export default function LaneConfigPanel({
  open,
  onClose,
  availableTickers,
  config,
  onToggle,
  onShowAll,
  onHideAll,
  onMove,
  onReset,
}) {
  const [draggedTicker, setDraggedTicker] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  if (!open) return null

  // Map ticker → metadata para mostrar nombre/sector
  const meta = new Map(availableTickers.map((t) => [t.ticker, t]))

  // Renderear según config.order, no según availableTickers — así
  // el orden custom se refleja.
  const rows = config.order
    .filter((t) => meta.has(t))
    .map((ticker, idx) => ({
      ticker,
      idx,
      info: meta.get(ticker),
      visible: config.visible.includes(ticker),
    }))

  const handleDragStart = (ticker) => {
    setDraggedTicker(ticker)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== idx) setDragOverIdx(idx)
  }

  const handleDrop = (e, toIdx) => {
    e.preventDefault()
    if (draggedTicker) onMove(draggedTicker, toIdx)
    setDraggedTicker(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDraggedTicker(null)
    setDragOverIdx(null)
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <aside className={styles.panel} role="dialog" aria-label="Configurar lanes">
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>LANES DEL DASHBOARD</div>
            <div className={styles.title}>
              {config.visible.length} de {rows.length} visibles
            </div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.bulkBar}>
          <button className={styles.bulkBtn} onClick={onShowAll}>mostrar todas</button>
          <button className={styles.bulkBtn} onClick={onHideAll}>ocultar todas</button>
          <button className={styles.bulkBtn} onClick={onReset}>reset orden</button>
        </div>

        <div className={styles.list}>
          {rows.length === 0 && (
            <div className={styles.empty}>SIN TICKERS CONFIGURADOS</div>
          )}
          {rows.map(({ ticker, idx, info, visible }) => {
            const isDragging = draggedTicker === ticker
            const isDropTarget = dragOverIdx === idx && draggedTicker && draggedTicker !== ticker
            return (
              <div
                key={ticker}
                className={`${styles.row} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
                draggable
                onDragStart={() => handleDragStart(ticker)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
              >
                <span className={styles.handle} title="Arrastrá para reordenar">≡</span>
                <button
                  type="button"
                  className={styles.check}
                  onClick={() => onToggle(ticker)}
                  aria-checked={visible}
                  role="checkbox"
                >
                  {visible ? '■' : '□'}
                </button>
                <span className={styles.ticker}>{ticker}</span>
                <span className={styles.name}>{info?.name}</span>
                {info?.sector && <span className={styles.sector}>{info.sector}</span>}
              </div>
            )
          })}
        </div>

        <footer className={styles.foot}>
          <span className={styles.note}>
            Arrastrá los handles (≡) para reordenar. El estado persiste en este browser.
          </span>
        </footer>
      </aside>
    </>
  )
}
