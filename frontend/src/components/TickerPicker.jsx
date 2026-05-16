import { useMemo, useState } from 'react'
import styles from './TickerPicker.module.css'

/*
 * TickerPicker — modal multi-select con search para elegir tickers.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   allTickers: TickerInfo[]   ← master list completa (incluye los sin sheet)
 *   selected: string[]          ← tickers actualmente seleccionados (símbolos)
 *   onChange: (newSelected: string[]) => void
 */
export default function TickerPicker({ open, onClose, allTickers, selected, onChange }) {
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(selected)

  // Sync cuando se abre — usar el snapshot actual
  const handleOpen = () => setDraft(selected)

  // Si recién se abre, recargá draft
  useMemo(() => {
    if (open) handleOpen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return allTickers
    return allTickers.filter(
      (t) =>
        t.ticker.includes(q) ||
        (t.name && t.name.toUpperCase().includes(q)) ||
        (t.sector && t.sector.toUpperCase().includes(q)),
    )
  }, [allTickers, query])

  if (!open) return null

  const toggle = (ticker) => {
    if (draft.includes(ticker)) {
      setDraft(draft.filter((t) => t !== ticker))
    } else {
      setDraft([...draft, ticker])
    }
  }

  const handleApply = () => {
    onChange(draft)
    onClose()
  }

  const handleClear = () => setDraft([])
  const handleSelectAll = () => setDraft(filtered.map((t) => t.ticker))

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-label="Seleccionar tickers">
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>SELECCIÓN DE TICKERS</div>
            <div className={styles.title}>{draft.length} de {allTickers.length} elegidos</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.searchBar}>
          <input
            type="text"
            className={styles.search}
            placeholder="Buscar ticker, nombre o sector…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className={styles.bulkBtn} onClick={handleSelectAll}>todos</button>
          <button className={styles.bulkBtn} onClick={handleClear}>ninguno</button>
        </div>

        <div className={styles.list}>
          {filtered.map((t) => {
            const isOn = draft.includes(t.ticker)
            return (
              <button
                key={t.ticker}
                type="button"
                className={`${styles.row} ${isOn ? styles.rowOn : ''}`}
                onClick={() => toggle(t.ticker)}
              >
                <span className={styles.check}>{isOn ? '■' : '□'}</span>
                <span className={styles.ticker}>{t.ticker}</span>
                <span className={styles.name}>{t.name}</span>
                {t.sector && <span className={styles.sector}>{t.sector}</span>}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className={styles.empty}>SIN MATCHES PARA "{query}"</div>
          )}
        </div>

        <footer className={styles.foot}>
          <button className={styles.cancel} onClick={onClose}>cancelar</button>
          <button className={styles.apply} onClick={handleApply}>
            aplicar ({draft.length})
          </button>
        </footer>
      </div>
    </>
  )
}
