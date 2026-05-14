import { useCallback, useEffect, useMemo, useState } from 'react'

/*
 * useLaneConfig — visibilidad y orden de los ticker lanes en el dashboard.
 *
 * Estado: { visible: string[], order: string[] }
 *  - visible: lista de tickers que se muestran (subset de availableTickers)
 *  - order: orden custom (mayor precedencia que el alfabético)
 *
 * Persiste en localStorage. Se auto-sincroniza con availableTickers:
 *  - Tickers nuevos (no en el state) → se agregan visibles, al final del orden
 *  - Tickers removidos del registry → se filtran del visible y del order
 */

const STORAGE_KEY = 'tradingstrategys.lane-config'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed == null) return null
    return {
      visible: Array.isArray(parsed.visible) ? parsed.visible : [],
      order: Array.isArray(parsed.order) ? parsed.order : [],
    }
  } catch {
    return null
  }
}

/**
 * @param availableTickers TickerInfo[] del backend (los que tienen sheet)
 */
export function useLaneConfig(availableTickers = []) {
  const [config, setConfig] = useState(() => loadFromStorage() ?? { visible: [], order: [] })

  // Sync con availableTickers: agregar nuevos, sacar los que ya no están
  useEffect(() => {
    if (!availableTickers.length) return
    const availableSet = new Set(availableTickers.map((t) => t.ticker))

    setConfig((prev) => {
      // Order: mantener los existentes en su posición, agregar nuevos al final
      const existing = prev.order.filter((t) => availableSet.has(t))
      const seen = new Set(existing)
      const newOnes = availableTickers
        .map((t) => t.ticker)
        .filter((t) => !seen.has(t))
      const order = [...existing, ...newOnes]

      // Visible: filtrar removidos, agregar nuevos como visibles
      const visibleFiltered = prev.visible.filter((t) => availableSet.has(t))
      const visibleSet = new Set(visibleFiltered)
      const visible = [
        ...visibleFiltered,
        ...newOnes.filter((t) => !visibleSet.has(t)),
      ]

      // Si nada cambió, no triggear re-render
      if (
        order.length === prev.order.length &&
        order.every((t, i) => t === prev.order[i]) &&
        visible.length === prev.visible.length &&
        visible.every((t, i) => t === prev.visible[i])
      ) {
        return prev
      }
      return { visible, order }
    })
  }, [availableTickers])

  // Persistir
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      /* ignore */
    }
  }, [config])

  // Lista final ordenada y filtrada por visibilidad
  const visibleOrdered = useMemo(() => {
    const visibleSet = new Set(config.visible)
    const byTicker = new Map(availableTickers.map((t) => [t.ticker, t]))
    return config.order
      .filter((t) => visibleSet.has(t) && byTicker.has(t))
      .map((t) => byTicker.get(t))
  }, [config, availableTickers])

  const toggleVisible = useCallback((ticker) => {
    setConfig((prev) => {
      const isOn = prev.visible.includes(ticker)
      return {
        ...prev,
        visible: isOn
          ? prev.visible.filter((t) => t !== ticker)
          : [...prev.visible, ticker],
      }
    })
  }, [])

  const showAll = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: [...prev.order] }))
  }, [])

  const hideAll = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: [] }))
  }, [])

  // Mueve `ticker` de su posición actual a la posición `toIdx` en el orden
  const moveTicker = useCallback((ticker, toIdx) => {
    setConfig((prev) => {
      const fromIdx = prev.order.indexOf(ticker)
      if (fromIdx < 0 || fromIdx === toIdx) return prev
      const newOrder = [...prev.order]
      newOrder.splice(fromIdx, 1)
      newOrder.splice(toIdx, 0, ticker)
      return { ...prev, order: newOrder }
    })
  }, [])

  const resetOrder = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      order: availableTickers.map((t) => t.ticker).sort(),
    }))
  }, [availableTickers])

  return {
    config,
    visibleOrdered,
    toggleVisible,
    showAll,
    hideAll,
    moveTicker,
    resetOrder,
  }
}
