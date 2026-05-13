import { useCallback, useState } from 'react'
import { api } from '../lib/api'

/*
 * useStrategy — para cuando el usuario re-corre una estrategia con
 * params custom desde el StrategySelector (drawer). On-demand, no auto.
 */
export function useStrategy(n) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (params) => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.runStrategy(n, params)
        setData(result)
        return result
      } catch (e) {
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [n],
  )

  return { data, loading, error, run }
}
