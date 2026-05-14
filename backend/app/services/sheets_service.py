"""
Google Sheets service usando API Key (solo lectura, spreadsheets públicas).
Cachea resultados para minimizar requests.
"""
from datetime import datetime
from typing import List, Optional
import logging
import threading

import httplib2
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from cachetools import TTLCache

from app.config import get_settings
from app.models.strategy import Ticker, PriceBar, TickerData


logger = logging.getLogger(__name__)

# Timeout más alto para tolerar latencia ocasional de Google bajo carga
# (60s en vez de 30s cubre cold-start lento + ocasional latencia de la API).
_HTTP_TIMEOUT_SECONDS = 60
# Cuánto esperan los waiters cuando otro thread está haciendo el fetch.
# 90s: cubre cold-start de Render free (~40-60s para levantar el dyno)
# + el fetch real a Google (~1-2s). En local/instances always-on alcanza con
# mucho menos, pero el costo de esperar de más es bajo y el costo de timeout
# espurio es un 500 visible en la UI.
_INFLIGHT_WAIT_SECONDS = 90


class SheetsService:
    """
    Cliente de Google Sheets API (solo lectura con API Key).

    Las spreadsheets deben estar compartidas como "Anyone with link can view".

    Concurrency: si llegan N requests para la misma cache_key con la cache
    fría, solo UNA llama a Google; las otras esperan al primer fetcher.
    Evita el burst que satura la API y dispara TimeoutErrors.
    """

    def __init__(self):
        self.settings = get_settings()
        # Http con timeout explícito (httplib2 default es muy bajo).
        http = httplib2.Http(timeout=_HTTP_TIMEOUT_SECONDS)
        self.service = build(
            "sheets",
            "v4",
            developerKey=self.settings.google_sheets_api_key,
            cache_discovery=False,
            http=http,
        )
        # Cache: 5 min TTL, max 100 entries
        self._cache: TTLCache = TTLCache(
            maxsize=100,
            ttl=self.settings.cache_ttl_seconds,
        )
        # In-flight request dedup: key → Event signaled when fetch resolves
        self._in_flight: dict[str, threading.Event] = {}
        self._in_flight_lock = threading.Lock()
        # Global lock alrededor de cada call a la Google API. CRÍTICO:
        # googleapiclient (httplib2 abajo) NO es thread-safe; sharear un
        # Http() entre threads corrompe memoria → SIGABRT del dyno.
        # Ver https://github.com/googleapis/google-api-python-client/blob/main/docs/thread_safety.md
        # Combinado con la dedup por key, la contención real es baja: cada
        # key única solo hace 1 call a Google.
        self._api_lock = threading.Lock()

    def _get_spreadsheet_id(self, ticker: Ticker) -> str:
        """Resuelve el spreadsheet_id desde el ticker.

        Usa merged_sheet_ids (env vars + sheet_ids_local.json) para que
        los tickers agregados via UI en local también funcionen.
        """
        # Import tardío para evitar dep circular en startup
        from app.services.tickers_service import merged_sheet_ids

        key = ticker.upper() if isinstance(ticker, str) else str(ticker).upper()
        spreadsheet_id = merged_sheet_ids().get(key)
        if not spreadsheet_id:
            raise ValueError(f"No spreadsheet configurado para ticker: {ticker}")
        return spreadsheet_id

    def read_range(
        self,
        ticker: Ticker,
        sheet_name: str,
        cell_range: str,
        unformatted: bool = False,
    ) -> List[List]:
        """
        Lee un rango de celdas de una sheet.

        Args:
            ticker: Ticker que mapea al spreadsheet
            sheet_name: Nombre de la pestaña (ej: "RAW_DATA")
            cell_range: Rango A1 (ej: "A2:G500")
            unformatted: Si True, Google devuelve valores RAW (numbers como
                         floats, no strings con formato local). Necesario para
                         FUNDAMENTALS donde el user puede tener "4,835.19" con
                         coma de miles que float() no parsea. Default False
                         (mantiene compat con RAW_DATA cuyo timestamp se parsea
                         como string).

        Returns:
            Lista de filas. Cada celda puede ser str/int/float según
            valueRenderOption.
        """
        ticker_key = ticker.upper() if isinstance(ticker, str) else str(ticker).upper()
        # Diferencio el cache por unformatted mode — datos crudos vs formateados
        # producen valores distintos en la respuesta.
        mode = "u" if unformatted else "f"
        cache_key = f"{ticker_key}:{sheet_name}:{cell_range}:{mode}"

        # 1. Cache hit (fast path, sin lock)
        if cache_key in self._cache:
            logger.debug(f"Cache HIT: {cache_key}")
            return self._cache[cache_key]

        # 2. Coordinar con otros threads: ¿soy el fetcher o waiter?
        with self._in_flight_lock:
            # Double-check dentro del lock por si otro thread populó la cache
            if cache_key in self._cache:
                return self._cache[cache_key]
            event = self._in_flight.get(cache_key)
            if event is None:
                # Soy el fetcher
                event = threading.Event()
                self._in_flight[cache_key] = event
                i_am_fetcher = True
            else:
                # Otro thread ya está fetcheando — espero
                i_am_fetcher = False

        if not i_am_fetcher:
            # Esperar a que el fetcher original termine
            signaled = event.wait(timeout=_INFLIGHT_WAIT_SECONDS)
            if signaled and cache_key in self._cache:
                logger.debug(f"Cache COALESCED: {cache_key}")
                return self._cache[cache_key]
            # Timeout o el fetcher falló — propagar como error claro
            raise TimeoutError(
                f"Esperando fetch concurrente de {cache_key} ({_INFLIGHT_WAIT_SECONDS}s)"
            )

        # 3. Soy el fetcher: llamar a Google y notificar waiters al final
        spreadsheet_id = self._get_spreadsheet_id(ticker)
        full_range = f"{sheet_name}!{cell_range}"
        try:
            # Lock global: googleapiclient/httplib2 NO son thread-safe.
            # Sin esto, llamadas simultáneas para keys distintas (GGAL/YPF/PAMP)
            # corrompen el estado interno del Http compartido → segfault.
            with self._api_lock:
                result = (
                    self.service.spreadsheets()
                    .values()
                    .get(
                        spreadsheetId=spreadsheet_id,
                        range=full_range,
                        valueRenderOption=(
                            "UNFORMATTED_VALUE" if unformatted else "FORMATTED_VALUE"
                        ),
                    )
                    .execute()
                )
            values = result.get("values", [])
            self._cache[cache_key] = values
            logger.info(f"Sheets READ: {ticker_key}/{sheet_name} ({len(values)} rows)")
            return values

        except HttpError as e:
            logger.error(f"Error leyendo Sheets: {e}")
            raise

        finally:
            # Limpiar in-flight y notificar waiters (haya éxito o no)
            with self._in_flight_lock:
                self._in_flight.pop(cache_key, None)
            event.set()

    def get_raw_data(self, ticker: Ticker, limit: int = 500) -> TickerData:
        """
        Lee la sheet RAW_DATA y la convierte a TickerData.

        Estructura esperada de RAW_DATA:
        Columna A: Timestamp
        Columna B: Open
        Columna C: High
        Columna D: Low
        Columna E: Close
        Columna F: Volume

        Se lee TODO el rango (A2:F sin end row) y luego se slicea las
        últimas `limit` barras. Antes leíamos A2:F{limit+1} que devolvía
        las PRIMERAS limit filas — funcionaba por casualidad cuando la
        sheet tenía ~limit filas, pero al expandir el histórico (ej. 5y)
        el chart mostraba las barras MÁS VIEJAS en lugar de las recientes.
        """
        # Range sin upper bound: la API de Sheets devuelve todas las filas
        # con datos. Cache key se vuelve estable (no depende del limit).
        rows = self.read_range(ticker, "RAW_DATA", "A2:F")

        bars: List[PriceBar] = []
        for row in rows:
            if len(row) < 6:
                continue
            # GOOGLEFINANCE inserta su propio header en la 1ra fila de su output
            # (['Date','Open','High','Low','Close','Volume']). Lo skipeamos
            # silencioso — no es una "row inválida", es comportamiento esperado.
            if row[0] == "Date" and row[1] == "Open":
                continue
            try:
                bars.append(
                    PriceBar(
                        timestamp=self._parse_timestamp(row[0]),
                        open=float(row[1]),
                        high=float(row[2]),
                        low=float(row[3]),
                        close=float(row[4]),
                        volume=float(row[5]),
                    )
                )
            except (ValueError, IndexError) as e:
                logger.warning(f"Skip row inválida: {row} - {e}")
                continue

        # Las barras vienen en orden cronológico ascendente. Tomar las
        # últimas `limit` para que el frontend siempre vea lo más reciente.
        if limit and len(bars) > limit:
            bars = bars[-limit:]

        return TickerData(
            ticker=ticker,
            bars=bars,
            last_updated=datetime.now(),
        )

    def get_fundamentals(self, ticker: Ticker) -> dict:
        """
        Lee la sheet FUNDAMENTALS del ticker (opcional, mantenida a mano).

        Formato esperado:
            Row 1: header (Metric, Value, AsOf) — skipeado
            Row 2+: A=metric_name, B=value (numérico), C=as_of (string, opcional)

        Returns dict {metric_name: float_value}. Si la sheet no existe,
        devuelve dict vacío en vez de raisear (la estrategia que necesite
        ese dato skipea el ticker en su ranking).

        Usa unformatted=True así Google devuelve los números crudos
        (sin formato local de miles/decimales que rompería float()).
        """
        try:
            rows = self.read_range(ticker, "FUNDAMENTALS", "A2:C", unformatted=True)
        except Exception as e:
            logger.debug(f"FUNDAMENTALS no disponible para {ticker}: {e}")
            return {}

        result: dict = {}
        for row in rows:
            if len(row) < 2:
                continue
            metric_raw = row[0]
            metric = (
                metric_raw.strip() if isinstance(metric_raw, str)
                else str(metric_raw).strip()
            )
            if not metric:
                continue
            value_raw = row[1]
            # Con unformatted=True ya viene como int/float si era número;
            # si por alguna razón llega como string, intentamos parsear
            # tolerando comas (formato es-AR/EN).
            try:
                if isinstance(value_raw, (int, float)):
                    result[metric] = float(value_raw)
                elif isinstance(value_raw, str):
                    cleaned = value_raw.strip().replace(",", "")
                    if cleaned:
                        result[metric] = float(cleaned)
                # else: skipear (None u otros)
            except (ValueError, TypeError):
                logger.warning(
                    f"FUNDAMENTALS {ticker}: valor no numérico para '{metric}': {value_raw!r}"
                )
                continue
        return result

    def get_strategy_sheet(
        self,
        ticker: Ticker,
        strategy_number: int,
        limit: int = 100,
    ) -> List[List[str]]:
        """
        Lee una sheet de estrategia específica.

        Sheet naming convention:
            STRATEGY_11_SMA
            STRATEGY_12_DMA
            STRATEGY_13_TMA
            STRATEGY_14_PIVOT
            STRATEGY_15_CHANNEL
            STRATEGY_18_PORTFOLIO
        """
        sheet_map = {
            11: "STRATEGY_11_SMA",
            12: "STRATEGY_12_DMA",
            13: "STRATEGY_13_TMA",
            14: "STRATEGY_14_PIVOT",
            15: "STRATEGY_15_CHANNEL",
            18: "STRATEGY_18_PORTFOLIO",
        }
        sheet_name = sheet_map.get(strategy_number)
        if not sheet_name:
            raise ValueError(f"Strategy {strategy_number} no soportada")

        return self.read_range(ticker, sheet_name, f"A2:Z{limit + 1}")

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        """Parsea timestamp en formatos comunes de Google Sheets."""
        # ⚠️ ORDEN CRÍTICO: M/D va PRIMERO porque GOOGLEFINANCE devuelve fechas
        # en US locale (M/D/Y) por default, sin importar el locale del Sheet.
        # Si pusiéramos D/M antes, fechas como "3/11/2025" (Mar 11) las parsearía
        # como d=3,m=11 → Nov 3 (silenciosamente mal). Solo fechas con día > 12
        # (ej. "3/13") harían fallar el match D/M y caerían a M/D.
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%m/%d/%Y %H:%M:%S",   # GOOGLEFINANCE M/D/Y con hora (más común)
            "%m/%d/%Y",            # GOOGLEFINANCE M/D/Y solo fecha
            "%d/%m/%Y %H:%M:%S",   # fallback para sheets en locale es-AR
            "%d/%m/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError(f"Formato de fecha no reconocido: {value}")

    def clear_cache(self):
        """Limpia el cache (útil para forzar refresh)."""
        self._cache.clear()
        logger.info("Cache de Sheets limpiado")


# Singleton instance
_sheets_service: Optional[SheetsService] = None


def get_sheets_service() -> SheetsService:
    """Dependency injection para FastAPI."""
    global _sheets_service
    if _sheets_service is None:
        _sheets_service = SheetsService()
    return _sheets_service
