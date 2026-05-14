import { useApi } from './useApi'
import { api } from '../lib/api'

/*
 * Lista de tickers disponibles (con sheet_id configurado en el backend).
 * Devuelve [{ticker, name, sector, currency}, ...]
 */
export function useTickers() {
  return useApi(() => api.listTickers(), [])
}

/*
 * Master list completa del registry (incluye los que aún no tienen
 * sheet_id). Para selectors / search.
 */
export function useAllTickers() {
  return useApi(() => api.listAllTickers(), [])
}
