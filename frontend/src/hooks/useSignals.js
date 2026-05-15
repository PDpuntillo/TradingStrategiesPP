import { useMemo } from 'react'
import { useApi } from './useApi'
import { api } from '../lib/api'
import { useAllStrategyParams } from './useStrategyParams'

/*
 * AllSignals: salida agregada de strategies 11..15 + consensus.
 *
 * Toma los params persistidos por (ticker × strategy) y los pasa al
 * backend, así el signal del rail refleja lo que el usuario configuró
 * en el drawer. Si nunca tocó nada → bundle son defaults → backend
 * usa los Pydantic defaults igual que antes.
 */
export function useSignals(ticker) {
  const bundle = useAllStrategyParams(ticker)
  // Stringify para que useApi detecte cambios en los params
  const bundleKey = useMemo(() => JSON.stringify(bundle), [bundle])
  return useApi(() => api.getSignals(ticker, bundle), [ticker, bundleKey])
}
