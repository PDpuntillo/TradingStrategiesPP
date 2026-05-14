import { useState } from 'react'
import { useAllTickers } from '../hooks/useTickers'
import { api } from '../lib/api'
import styles from './AddTickerModal.module.css'

/*
 * AddTickerModal — UI para agregar un ticker al registry sin tocar
 * env vars manualmente.
 *
 * Flow:
 * 1. Usuario completa: símbolo, sheet_id_or_url, (autofill name desde master)
 * 2. POST /api/tickers/add
 * 3. Backend en DEV: persiste a sheet_ids_local.json → ticker queda activo
 *    Backend en PROD: NO persiste pero devuelve un snippet listo para
 *    pegar al SHEET_IDS_JSON de Render
 * 4. Mostramos el snippet siempre (para deployar a prod) + onSuccess
 *    callback para que el dashboard refresque la lista
 */
export default function AddTickerModal({ open, onClose, onSuccess }) {
  const { data: allTickers } = useAllTickers()
  const [ticker, setTicker] = useState('')
  const [sheetIdOrUrl, setSheetIdOrUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  if (!open) return null

  const meta = (allTickers ?? []).find(
    (t) => t.ticker === ticker.trim().toUpperCase(),
  )

  const reset = () => {
    setTicker('')
    setSheetIdOrUrl('')
    setError(null)
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.addTicker(ticker.trim().toUpperCase(), sheetIdOrUrl.trim())
      setResult(res)
      onSuccess?.()
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard?.writeText(result.snippet_for_prod)
  }

  return (
    <>
      <div className={styles.overlay} onClick={handleClose} aria-hidden />
      <div className={styles.modal} role="dialog" aria-label="Agregar ticker">
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>NUEVO TICKER</div>
            <div className={styles.title}>Agregar al registry</div>
          </div>
          <button className={styles.close} onClick={handleClose} aria-label="Cerrar">×</button>
        </header>

        {!result && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.lbl}>SÍMBOLO</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="TXAR"
                autoFocus
                required
                pattern="[A-Za-z0-9]+"
                maxLength={8}
              />
              {meta && (
                <span className={styles.hint}>
                  ✓ {meta.name}{meta.sector ? ` · ${meta.sector}` : ''}
                </span>
              )}
              {ticker && !meta && ticker.length >= 3 && (
                <span className={styles.hintMuted}>
                  no está en el master tickers_meta.json — se va a mostrar como "{ticker.toUpperCase()}"
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.lbl}>SHEET ID O URL</label>
              <input
                type="text"
                value={sheetIdOrUrl}
                onChange={(e) => setSheetIdOrUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit  ó  1AbC..."
                required
                minLength={20}
              />
              <span className={styles.hintMuted}>
                la sheet debe estar compartida como "Anyone with link → Viewer"
              </span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={handleClose}>
                cancelar
              </button>
              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? 'GUARDANDO…' : 'AGREGAR'}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className={styles.result}>
            <div className={styles.resultStatus}>
              {result.persisted_locally ? (
                <>
                  <span className={styles.dot} style={{ background: 'var(--sig-long)' }} />
                  <span>
                    Ticker <strong>{result.ticker}</strong> agregado al registry local.
                    Refrescá el dashboard si no aparece automáticamente.
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.dot} style={{ background: 'var(--accent-amber)' }} />
                  <span>
                    En PROD el filesystem es efímero. Agregalo manualmente al
                    env var <code>SHEET_IDS_JSON</code> en el dashboard de Render
                    para que persista.
                  </span>
                </>
              )}
            </div>

            <div className={styles.snippetBox}>
              <div className={styles.snippetLabel}>
                <span>SHEET_IDS_JSON =</span>
                <button type="button" className={styles.copyBtn} onClick={handleCopy}>
                  ⧉ Copiar
                </button>
              </div>
              <pre className={styles.snippet}>{result.snippet_for_prod}</pre>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={reset}>
                agregar otro
              </button>
              <button type="button" className={styles.submit} onClick={handleClose}>
                listo
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
