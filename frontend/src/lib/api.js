/*
 * Cliente HTTP minimal.
 *
 * Dev: VITE_API_BASE_URL no seteado → usa "/api" → Vite proxy → http://127.0.0.1:8000
 *      (ver vite.config.js)
 * Prod: VITE_API_BASE_URL seteado en Vercel a la URL pública del backend
 *       (ej: https://tu-backend.onrender.com/api)
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body || path}`)
  }

  return res.json()
}

export const api = {
  // ===== Tickers =====
  listTickers: () => request('/tickers'),
  listAllTickers: () => request('/tickers/all'),
  addTicker: (ticker, sheetIdOrUrl) =>
    request('/tickers/add', {
      method: 'POST',
      body: JSON.stringify({ ticker, sheet_id_or_url: sheetIdOrUrl }),
    }),
  getTicker: (ticker, limit = 500) => request(`/ticker/${ticker}?limit=${limit}`),

  // ===== Strategies (POST) =====
  runStrategy: (n, params) =>
    request(`/strategy/${n}`, { method: 'POST', body: JSON.stringify(params) }),

  // ===== Cross-sectional strategies =====
  runCrossStrategy: (name, params) =>
    request(`/cross/${name}`, { method: 'POST', body: JSON.stringify(params) }),

  // ===== Signals + consensus =====
  // POST con bundle opcional: { strategy_11: {...}, strategy_12: {...}, ... }
  // Cada campo faltante usa los defaults de Pydantic en el backend.
  getSignals: (ticker, paramsBundle = null) =>
    request(`/signals/${ticker}`, {
      method: 'POST',
      body: JSON.stringify(paramsBundle ?? {}),
    }),

  // ===== Cache =====
  clearCache: () => request('/cache/clear', { method: 'POST' }),
}
