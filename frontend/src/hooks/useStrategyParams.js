import { useCallback, useEffect, useState } from 'react'

/*
 * useStrategyParams — params per (ticker × strategy) persistidos en localStorage.
 *
 * Sirve de fuente de verdad compartida entre:
 *   - StrategySelector (drawer): el form los lee al abrir y los persiste al ejecutar
 *   - ConsensusRail: el chip gris bajo el nombre los renderiza con formatParams()
 *
 * Storage key: tradingstrategys.params.<TICKER>.<n>
 * Si el ticker o la strategy no tienen entry guardada, devuelve los defaults.
 */

// Defaults — single source of truth, espejo de los del backend (Pydantic).
export const STRATEGY_DEFAULTS = {
  11: { ma_period: 20, ma_type: 'SMA' },
  12: { ma_short_period: 10, ma_long_period: 30, stop_loss_pct: 0.02 },
  13: { ma1_period: 3, ma2_period: 10, ma3_period: 21 },
  14: {},
  15: { channel_period: 20 },
}

const storageKey = (ticker, n) => `tradingstrategys.params.${ticker}.${n}`

function loadParams(ticker, n) {
  if (!ticker || n == null) return STRATEGY_DEFAULTS[n] ?? {}
  try {
    const raw = localStorage.getItem(storageKey(ticker, n))
    if (!raw) return STRATEGY_DEFAULTS[n] ?? {}
    const parsed = JSON.parse(raw)
    return { ...(STRATEGY_DEFAULTS[n] ?? {}), ...parsed }
  } catch {
    return STRATEGY_DEFAULTS[n] ?? {}
  }
}

function saveParams(ticker, n, params) {
  if (!ticker || n == null) return
  try {
    localStorage.setItem(storageKey(ticker, n), JSON.stringify(params))
  } catch {
    /* ignore */
  }
}

function clearParams(ticker, n) {
  if (!ticker || n == null) return
  try {
    localStorage.removeItem(storageKey(ticker, n))
  } catch {
    /* ignore */
  }
}

function notifyChange(ticker, n) {
  window.dispatchEvent(
    new CustomEvent('strategy-params-changed', {
      detail: { key: storageKey(ticker, n) },
    }),
  )
}

export function useStrategyParams(ticker, n) {
  const [params, setParamsState] = useState(() => loadParams(ticker, n))

  // Re-leer si cambia ticker o strategy
  useEffect(() => {
    setParamsState(loadParams(ticker, n))
  }, [ticker, n])

  // Re-leer si OTRO componente (ej. el drawer) cambió el storage
  useEffect(() => {
    if (!ticker || n == null) return
    const key = storageKey(ticker, n)
    const onStorage = (e) => {
      if (e.key === key) setParamsState(loadParams(ticker, n))
    }
    window.addEventListener('storage', onStorage)
    // Custom event para cambios DENTRO de la misma pestaña (storage event no dispara)
    const onLocal = (e) => {
      if (e.detail?.key === key) setParamsState(loadParams(ticker, n))
    }
    window.addEventListener('strategy-params-changed', onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('strategy-params-changed', onLocal)
    }
  }, [ticker, n])

  const setParams = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(params) : next
      setParamsState(value)
      saveParams(ticker, n, value)
      notifyChange(ticker, n)
    },
    [ticker, n, params],
  )

  // Reset → vuelve a los defaults estáticos y limpia el storage
  const resetParams = useCallback(() => {
    const defaults = STRATEGY_DEFAULTS[n] ?? {}
    setParamsState(defaults)
    clearParams(ticker, n)
    notifyChange(ticker, n)
  }, [ticker, n])

  return [params, setParams, resetParams]
}

/*
 * useAllStrategyParams — agrega los params de las 5 estrategias para un
 * ticker en un único objeto, listo para mandar al backend en /signals.
 *
 * Re-renderea cuando cualquiera de las 5 keys cambia (storage o evento
 * custom de la misma pestaña).
 */
const STRATEGY_NUMS = [11, 12, 13, 14, 15]

export function useAllStrategyParams(ticker) {
  const buildBundle = useCallback(() => {
    const bundle = {}
    STRATEGY_NUMS.forEach((n) => {
      bundle[`strategy_${n}`] = loadParams(ticker, n)
    })
    return bundle
  }, [ticker])

  const [bundle, setBundle] = useState(buildBundle)

  useEffect(() => {
    setBundle(buildBundle())
  }, [ticker, buildBundle])

  useEffect(() => {
    if (!ticker) return
    const watched = new Set(STRATEGY_NUMS.map((n) => storageKey(ticker, n)))
    const onAnyChange = (e) => {
      const key = e?.detail?.key ?? e?.key
      if (!key || watched.has(key)) {
        setBundle(buildBundle())
      }
    }
    window.addEventListener('storage', onAnyChange)
    window.addEventListener('strategy-params-changed', onAnyChange)
    return () => {
      window.removeEventListener('storage', onAnyChange)
      window.removeEventListener('strategy-params-changed', onAnyChange)
    }
  }, [ticker, buildBundle])

  return bundle
}

// Formatters por estrategia — render compacto para el chip de la rail.
export const PARAM_FORMATTERS = {
  11: (p) => `${p.ma_type ?? 'SMA'} · ${p.ma_period ?? 20}`,
  12: (p) =>
    `${p.ma_short_period ?? 10}/${p.ma_long_period ?? 30} · SL ${(
      (p.stop_loss_pct ?? 0.02) * 100
    ).toFixed(1)}%`,
  13: (p) =>
    `${p.ma1_period ?? 3}/${p.ma2_period ?? 10}/${p.ma3_period ?? 21}`,
  14: () => 'H/L/C prev',
  15: (p) => `N=${p.channel_period ?? 20}`,
}

export function formatStrategyParams(n, params) {
  const fmt = PARAM_FORMATTERS[n]
  if (!fmt) return null
  return fmt(params ?? STRATEGY_DEFAULTS[n] ?? {})
}
