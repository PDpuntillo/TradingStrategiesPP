import { useCallback, useEffect, useState } from 'react'

/*
 * useChartOverlays(ticker) — qué overlays de estrategia están visibles
 * sobre el chart del ticker. Persistido en localStorage; sincronizado
 * entre componentes (rail + chart) en la misma pestaña via custom event.
 *
 * Storage key: tradingstrategys.chart-overlays.<TICKER>  →  JSON array de
 * strategy numbers visibles (ej. [11, 14]).
 */

const storageKey = (ticker) => `tradingstrategys.chart-overlays.${ticker}`
const EVENT_NAME = 'chart-overlays-changed'

function loadOverlays(ticker) {
  if (!ticker) return new Set()
  try {
    const raw = localStorage.getItem(storageKey(ticker))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [])
  } catch {
    return new Set()
  }
}

function saveOverlays(ticker, set) {
  if (!ticker) return
  try {
    localStorage.setItem(storageKey(ticker), JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}

export function useChartOverlays(ticker) {
  const [overlays, setOverlays] = useState(() => loadOverlays(ticker))

  // Re-leer si cambia ticker
  useEffect(() => {
    setOverlays(loadOverlays(ticker))
  }, [ticker])

  // Sincronizar con otros consumers (storage event entre tabs, custom dentro de la tab)
  useEffect(() => {
    if (!ticker) return
    const key = storageKey(ticker)
    const onStorage = (e) => {
      if (e.key === key) setOverlays(loadOverlays(ticker))
    }
    const onLocal = (e) => {
      if (e.detail?.ticker === ticker) setOverlays(loadOverlays(ticker))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENT_NAME, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENT_NAME, onLocal)
    }
  }, [ticker])

  const toggle = useCallback(
    (n) => {
      const next = new Set(overlays)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      setOverlays(next)
      saveOverlays(ticker, next)
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ticker } }))
    },
    [overlays, ticker],
  )

  const isVisible = useCallback((n) => overlays.has(n), [overlays])

  return { overlays, toggle, isVisible }
}
