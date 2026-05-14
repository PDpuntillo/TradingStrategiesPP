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
import re
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from app.config import get_settings
from app.models.strategy import TickerInfo


logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent / "data"
_META_PATH = _DATA_DIR / "tickers_meta.json"
# Solo se usa en local. En prod (filesystem ephemeral) este archivo no
# persiste entre restarts del dyno, así que escrituras no tienen sentido.
_LOCAL_SHEET_IDS_PATH = _DATA_DIR / "sheet_ids_local.json"


def _extract_sheet_id(input_str: str) -> str:
    """Acepta sheet_id puro o URL completa de Google Sheets."""
    s = input_str.strip()
    # URL: https://docs.google.com/spreadsheets/d/<ID>/edit?...
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", s)
    if m:
        return m.group(1)
    return s


def _load_local_sheet_ids() -> dict[str, str]:
    """Lee sheet_ids_local.json (dev-only persistence)."""
    if not _LOCAL_SHEET_IDS_PATH.exists():
        return {}
    try:
        with _LOCAL_SHEET_IDS_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {k.upper(): v for k, v in data.items() if v}
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"sheet_ids_local.json invalido: {e}")
    return {}


def _save_local_sheet_ids(ids: dict[str, str]) -> None:
    """Persiste sheet_ids_local.json. NO usar en prod."""
    _DATA_DIR.mkdir(exist_ok=True)
    with _LOCAL_SHEET_IDS_PATH.open("w", encoding="utf-8") as f:
        json.dump(ids, f, indent=2, ensure_ascii=False)


def merged_sheet_ids() -> dict[str, str]:
    """
    Mapa final ticker → sheet_id, mergeando:
    1. Settings (env vars: legacy SPREADSHEET_ID_* y SHEET_IDS_JSON)
    2. sheet_ids_local.json (dev only — overrides env)
    """
    result = dict(get_settings().spreadsheet_ids_map)
    result.update(_load_local_sheet_ids())
    return result


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

    Un ticker está "disponible" cuando tiene un sheet_id configurado
    (env var o local JSON). La metadata es opcional — si no está en
    tickers_meta.json el name cae al símbolo.
    """
    meta = _load_meta()
    sheet_ids = merged_sheet_ids()

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
    meta = _load_meta()

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
    return ticker.upper() in merged_sheet_ids()


def add_local_ticker(ticker: str, sheet_id_or_url: str) -> dict:
    """
    Agrega un ticker al sheet_ids_local.json (dev-only).

    Returns un dict con info para que el frontend pueda mostrar:
    - el snippet listo para copiar al SHEET_IDS_JSON env var de prod
    - el estado (writable / readonly) según si estamos en dev

    Raises ValueError si el input es invalido.
    """
    t = ticker.strip().upper()
    if not t or not t.isalnum():
        raise ValueError(
            f"Ticker '{ticker}' inválido — usá solo letras/números"
        )

    sid = _extract_sheet_id(sheet_id_or_url)
    if not sid or len(sid) < 20:
        raise ValueError(
            f"Sheet ID '{sid}' parece inválido — debería ser un string alfanumérico de ~44 chars"
        )

    settings = get_settings()
    writable = settings.debug

    if writable:
        current = _load_local_sheet_ids()
        current[t] = sid
        _save_local_sheet_ids(current)
        logger.info(f"Ticker {t} agregado a sheet_ids_local.json")
    else:
        logger.info(f"Ticker {t} solicitado en prod — no persistido (filesystem ephemeral)")

    # Snippet para copiar a Render dashboard
    full_map = merged_sheet_ids()
    if not writable:
        # En prod, simulamos el merge para mostrarle qué quedaría
        full_map[t] = sid

    # Snippet listo para pegar en Render. Formato simple KEY=VALUE
    # (lo que Render acepta directo en el modal "Add from .env" o en
    # el form key/value sin necesidad de quoting).
    snippet_envline = f"SPREADSHEET_ID_{t}={sid}"

    return {
        "ticker": t,
        "sheet_id": sid,
        "persisted_locally": writable,
        "snippet_for_prod": snippet_envline,   # SPREADSHEET_ID_TXAR=hilodenumeros
        "render_key": f"SPREADSHEET_ID_{t}",   # para el form key/value
        "render_value": sid,                   # para el campo VALUE
    }
