import { useApi } from './useApi'
import { api } from '../lib/api'

// Trae RAW_DATA del ticker (OHLCV). limit = últimas N barras.
// Default 1500 ≈ 6 años de trading days — cubre cualquier período del chart
// selector (1M/3M/6M/1Y/2Y/MAX). El backend devuelve menos si la sheet
// tiene menos data; el chart slicea client-side al período elegido.
//
// Si ticker es null/undefined, devuelve null sin pegar al backend.
export function useTickerData(ticker, limit = 1500) {
  return useApi(
    () => (ticker ? api.getTicker(ticker, limit) : Promise.resolve(null)),
    [ticker, limit],
  )
}
