import { useCallback, useState } from 'react'
import { api } from '../lib/api'

/*
 * Hook genérico para correr cualquier estrategia cross-sectional
 * (price_momentum, low_volatility, value, multifactor, pairs, mr).
 *
 * Devuelve: { data, loading, error, run(params) }
 * `run(params)` retorna la promise para que el caller pueda awaitearla.
 */
export function useCrossStrategy(name) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(
    async (params) => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.runCrossStrategy(name, params)
        setData(result)
        return result
      } catch (e) {
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [name],
  )

  return { data, loading, error, run }
}
