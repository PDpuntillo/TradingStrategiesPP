import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * useApi — wrapper genérico para llamadas fetch.
 * Maneja loading / error / data + refetch manual.
 *
 * fetcher: () => Promise<T>
 * deps: array de deps (como useEffect)
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const cancelRef = useRef(false)

  const exec = useCallback(async () => {
    cancelRef.current = false
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (!cancelRef.current) setData(result)
    } catch (e) {
      if (!cancelRef.current) setError(e)
    } finally {
      if (!cancelRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    exec()
    return () => {
      cancelRef.current = true
    }
  }, [exec])

  return { data, loading, error, refetch: exec }
}
