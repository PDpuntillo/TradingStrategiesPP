import { useState } from 'react'
import EyeIcon from './EyeIcon'
import styles from './LaneConfigPanel.module.css'

/*
 * LaneConfigPanel — modal para configurar qué lanes se ven y en qué orden.
 *
 * Visibilidad: botón ojo por ticker (toggle on/off).
 * Orden: drag-and-drop. Cada row tiene un drag handle (≡) y es draggable.
 * Search: filtra in-place por ticker / nombre / sector — no afecta el
 *         orden persistido, solo qué rows se ven en el panel.
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
  const [query, setQuery] = useState('')

  if (!open) return null

  const meta = new Map(availableTickers.map((t) => [t.ticker, t]))

  // Renderear según config.order, no según availableTickers — así el
  // orden custom se refleja. El índice (`idx`) se mantiene contra
  // config.order para que el drop reordene la lista entera.
  const rows = config.order
    .filter((t) => meta.has(t))
    .map((ticker, idx) => ({
      ticker,
      idx,
      info: meta.get(ticker),
      visible: config.visible.includes(ticker),
    }))

  // Filtro client-side por ticker / nombre / sector
  const q = query.trim().toLowerCase()
  const filteredRows = q
    ? rows.filter((r) => {
        const t = r.ticker.toLowerCase()
        const n = (r.info?.name ?? '').toLowerCase()
        const s = (r.info?.sector ?? '').toLowerCase()
        return t.includes(q) || n.includes(q) || s.includes(q)
      })
    : rows

  const handleDragStart = (ticker) => setDraggedTicker(ticker)
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

  // Mientras hay query activa deshabilitamos drag — el orden visible no
  // coincide con el orden de config.order, así que un drop generaría
  // movimientos incorrectos.
  const dragDisabled = q.length > 0

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

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <line x1="10.5" y1="10.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className={styles.search}
              placeholder="buscar ticker, nombre o sector…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                title="Limpiar"
              >
                ×
              </button>
            )}
          </div>
          <div className={styles.bulkBar}>
            <button className={styles.bulkBtn} onClick={onShowAll}>mostrar todas</button>
            <button className={styles.bulkBtn} onClick={onHideAll}>ocultar todas</button>
            <button className={styles.bulkBtn} onClick={onReset}>reset orden</button>
          </div>
        </div>

        <div className={styles.colHead}>
          <span /> {/* handle */}
          <span /> {/* eye */}
          <span className={styles.colLbl}>TICKER</span>
          <span className={styles.colLbl}>NOMBRE</span>
          <span className={styles.colLbl}>SECTOR</span>
        </div>

        <div className={styles.list}>
          {rows.length === 0 && (
            <div className={styles.empty}>SIN TICKERS CONFIGURADOS</div>
          )}
          {rows.length > 0 && filteredRows.length === 0 && (
            <div className={styles.empty}>
              SIN MATCHES PARA "{query}"
            </div>
          )}
          {filteredRows.map(({ ticker, idx, info, visible }) => {
            const isDragging = draggedTicker === ticker
            const isDropTarget = dragOverIdx === idx && draggedTicker && draggedTicker !== ticker
            return (
              <div
                key={ticker}
                className={`${styles.row} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
                draggable={!dragDisabled}
                onDragStart={() => handleDragStart(ticker)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
              >
                <span
                  className={`${styles.handle} ${dragDisabled ? styles.handleDisabled : ''}`}
                  title={dragDisabled ? 'Limpiá la búsqueda para reordenar' : 'Arrastrá para reordenar'}
                >
                  ≡
                </span>
                <button
                  type="button"
                  className={`${styles.eyeBtn} ${visible ? styles.eyeBtnActive : ''}`}
                  onClick={() => onToggle(ticker)}
                  aria-checked={visible}
                  role="checkbox"
                  title={visible ? `Ocultar lane ${ticker}` : `Mostrar lane ${ticker}`}
                >
                  <EyeIcon active={visible} />
                </button>
                <span className={styles.ticker}>{ticker}</span>
                <span className={styles.name} title={info?.name}>{info?.name}</span>
                <span className={styles.sector} title={info?.sector}>{info?.sector ?? '—'}</span>
              </div>
            )
          })}
        </div>

        <footer className={styles.foot}>
          <span className={styles.note}>
            {dragDisabled
              ? 'Limpiá la búsqueda para arrastrar y reordenar.'
              : 'Arrastrá los handles (≡) para reordenar. El estado persiste en este browser.'}
          </span>
        </footer>
      </aside>
    </>
  )
}
