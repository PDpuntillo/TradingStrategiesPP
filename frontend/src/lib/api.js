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
  getTicker: (ticker, limit = 500) => request(`/ticker/${ticker}?limit=${limit}`),

  // ===== Strategies (POST) =====
  runStrategy: (n, params) =>
    request(`/strategy/${n}`, { method: 'POST', body: JSON.stringify(params) }),

  // ===== Signals + consensus =====
  getSignals: (ticker) => request(`/signals/${ticker}`),

  // ===== Cache =====
  clearCache: () => request('/cache/clear', { method: 'POST' }),
}
