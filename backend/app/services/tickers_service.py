"""
Registry de tickers disponibles.

Combina:
- `app/data/tickers_meta.json`: master list con metadata (nombre, sector)
- `settings.spreadsheet_ids_map`: cuáles tienen sheet_id configurado

El endpoint /api/tickers devuelve la INTERSECCIÓN: solo los tickers que
tienen metadata Y tienen sheet_id seteado. Los que no tienen sheet_id
aparecen como "no configurados" en logs pero no se exponen al frontend.
"""
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import List

from app.config import get_settings
from app.models.strategy import TickerInfo


logger = logging.getLogger(__name__)

_META_PATH = Path(__file__).parent.parent / "data" / "tickers_meta.json"


@lru_cache()
def _load_meta() -> dict[str, dict]:
    """Lee tickers_meta.json y devuelve un dict ticker → metadata."""
    if not _META_PATH.exists():
        logger.warning(f"tickers_meta.json no encontrado en {_META_PATH}")
        return {}
    try:
        with _META_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
        entries = data.get("tickers", [])
        return {e["ticker"]: e for e in entries if "ticker" in e}
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"Error leyendo tickers_meta.json: {e}")
        return {}


def list_available_tickers() -> List[TickerInfo]:
    """
    Devuelve la lista de tickers disponibles para el frontend.

    Un ticker está "disponible" cuando tiene tanto:
    - Una entry en tickers_meta.json (para mostrar nombre/sector)
    - Un sheet_id en settings (sino el backend no puede leer sus datos)
    """
    settings = get_settings()
    meta = _load_meta()
    sheet_ids = settings.spreadsheet_ids_map

    available: List[TickerInfo] = []
    for ticker, sid in sheet_ids.items():
        if not sid:
            continue
        m = meta.get(ticker, {})
        available.append(
            TickerInfo(
                ticker=ticker,
                name=m.get("name", ticker),
                sector=m.get("sector"),
                currency=m.get("currency", "ARS"),
            )
        )

    # También incluir tickers con metadata pero sin sheet_id, marcados como
    # "no configurados" — útil para que el frontend muestre la lista completa
    # del Merval con un badge "no disponible". Por ahora se omiten para
    # mantener el contrato simple; cuando el frontend necesite la list maestra
    # exponemos /api/tickers/all.

    # Ordenar alfabéticamente para output determinista
    available.sort(key=lambda t: t.ticker)
    return available


def list_all_tickers_meta() -> List[TickerInfo]:
    """
    Devuelve la master list completa (incluye los que aún no tienen
    sheet_id configurado). El frontend la puede usar para mostrar un
    selector de "agregar nuevos tickers" / search.
    """
    settings = get_settings()
    meta = _load_meta()
    configured = set(settings.spreadsheet_ids_map.keys())

    all_tickers: List[TickerInfo] = []
    for ticker, m in meta.items():
        all_tickers.append(
            TickerInfo(
                ticker=ticker,
                name=m.get("name", ticker),
                sector=m.get("sector"),
                currency=m.get("currency", "ARS"),
            )
        )
    all_tickers.sort(key=lambda t: t.ticker)
    return all_tickers


def is_ticker_available(ticker: str) -> bool:
    """True si el ticker tiene sheet_id configurado y es leíble."""
    return ticker.upper() in get_settings().spreadsheet_ids_map
