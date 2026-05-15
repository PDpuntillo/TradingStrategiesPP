import { useEffect, useState } from 'react'

/*
 * Hook para manejar qué estrategias están habilitadas globalmente.
 * Persiste en localStorage. Default: las 5 con signal (11..15).
 *
 * Cuando agreguemos más estrategias del paper, sumarlas a STRATEGY_REGISTRY
 * abajo y van a aparecer en el toggle automáticamente.
 */

export const STRATEGY_REGISTRY = [
  { n: 11, name: 'Single MA',   short: 'SMA', refKey: 'ma_value',     refLbl: 'MA' },
  { n: 12, name: 'Dual MA',     short: 'DMA', refKey: 'ma_long',      refLbl: 'MA-LONG' },
  { n: 13, name: 'Triple MA',   short: 'TMA', refKey: 'ma3',          refLbl: 'MA-SLOW' },
  { n: 14, name: 'Pivot Point', short: 'PVT', refKey: 'pivot',        refLbl: 'PIVOT' },
  { n: 15, name: 'Donchian',    short: 'CHN', refKey: 'band_upper',   refLbl: 'BAND-UP' },
  // Futuro: agregar más entries aquí (16, 17, 19+) cuando se implementen.
  // Los params se renderean desde useStrategyParams (persisted live).
]

const STORAGE_KEY = 'tradingstrategys.enabled-strategies'
const DEFAULT_ENABLED = STRATEGY_REGISTRY.map((s) => s.n)

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ENABLED
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_ENABLED
    return parsed.filter((n) => typeof n === 'number')
  } catch {
    return DEFAULT_ENABLED
  }
}

export function useEnabledStrategies() {
  const [enabled, setEnabled] = useState(loadFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled))
    } catch {
      /* ignore */
    }
  }, [enabled])

  const toggle = (n) =>
    setEnabled((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    )

  const enableAll = () => setEnabled(STRATEGY_REGISTRY.map((s) => s.n))
  const disableAll = () => setEnabled([])
  const reset = () => setEnabled(DEFAULT_ENABLED)

  return { enabled, toggle, enableAll, disableAll, reset }
}
