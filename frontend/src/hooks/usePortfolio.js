import { useCallback, useState } from 'react'
import { api } from '../lib/api'

// Strategy 18 — Sharpe maximization. On-demand (no auto-fetch).
export function usePortfolio() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const optimize = useCallback(async (params) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.runStrategy(18, params)
      setData(result)
      return result
    } catch (e) {
      setError(e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, optimize }
}
