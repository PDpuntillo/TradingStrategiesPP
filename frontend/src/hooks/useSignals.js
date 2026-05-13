import { useApi } from './useApi'
import { api } from '../lib/api'

// AllSignals: salida agregada de strategies 11..15 + consensus.
export function useSignals(ticker) {
  return useApi(() => api.getSignals(ticker), [ticker])
}
