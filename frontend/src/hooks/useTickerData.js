import { useApi } from './useApi'
import { api } from '../lib/api'

// Trae RAW_DATA del ticker (OHLCV). limit = barras desde la última.
// Si ticker es null/undefined, devuelve null sin pegar al backend.
export function useTickerData(ticker, limit = 250) {
  return useApi(
    () => (ticker ? api.getTicker(ticker, limit) : Promise.resolve(null)),
    [ticker, limit],
  )
}
