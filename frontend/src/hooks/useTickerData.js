import { useApi } from './useApi'
import { api } from '../lib/api'

// Trae RAW_DATA del ticker (OHLCV). limit = barras desde la última.
export function useTickerData(ticker, limit = 250) {
  return useApi(() => api.getTicker(ticker, limit), [ticker, limit])
}
