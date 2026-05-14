"""
Endpoints REST para las 6 estrategias del paper.
"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from app.models.strategy import (
    Ticker,
    TickerInfo,
    TickerData,
    AllSignals,
    Strategy11Input, Strategy11Output,
    Strategy12Input, Strategy12Output,
    Strategy13Input, Strategy13Output,
    Strategy14Input, Strategy14Output,
    Strategy15Input, Strategy15Output,
    Strategy18Input, Strategy18Output,
    PriceMomentumInput, LowVolatilityInput, ValueInput, MultifactorInput,
    PairsInput, PairsOutput,
    CrossRankingOutput,
)
from app.services.sheets_service import SheetsService, get_sheets_service
from app.services.strategy_service import (
    strategy_11, strategy_12, strategy_13,
    strategy_14, strategy_15, strategy_18,
    price_momentum, low_volatility, value_strategy, multifactor,
    pairs_trading,
    compute_consensus_signal,
)
from app.services.tickers_service import (
    list_available_tickers,
    list_all_tickers_meta,
    is_ticker_available,
    add_local_ticker,
)
from pydantic import BaseModel


router = APIRouter(prefix="/api", tags=["strategies"])


def _validate_ticker(ticker: str) -> str:
    """Normaliza a uppercase y valida que esté disponible."""
    t = ticker.upper()
    if not is_ticker_available(t):
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{t}' no configurado. Ver /api/tickers para la lista disponible.",
        )
    return t


# ============================================
# TICKERS REGISTRY
# ============================================
@router.get("/tickers", response_model=List[TickerInfo])
def list_tickers():
    """Lista de tickers disponibles (con sheet configurado y metadata)."""
    return list_available_tickers()


@router.get("/tickers/all", response_model=List[TickerInfo])
def list_all_tickers():
    """
    Master list completa del registry (incluye tickers sin sheet configurado).
    Útil para que el frontend muestre un selector con la lista completa Merval.
    """
    return list_all_tickers_meta()


class AddTickerInput(BaseModel):
    ticker: str
    sheet_id_or_url: str


class AddTickerOutput(BaseModel):
    ticker: str
    sheet_id: str
    persisted_locally: bool
    snippet_for_prod: str   # SPREADSHEET_ID_<TICKER>=<sheet_id> — pasteable en "Add from .env"
    render_key: str         # para el form key/value de Render: este va al field KEY
    render_value: str       # para el form key/value de Render: este va al field VALUE


@router.post("/tickers/add", response_model=AddTickerOutput)
def add_ticker(payload: AddTickerInput):
    """
    Agrega un ticker al registry.

    En dev (DEBUG=True): persiste a sheet_ids_local.json y queda
    inmediatamente disponible en el listing.

    En prod (DEBUG=False): NO persiste (filesystem efímero), pero
    devuelve el snippet que el usuario tiene que copiar al env var
    SHEET_IDS_JSON en el dashboard de Render.
    """
    try:
        return AddTickerOutput(**add_local_ticker(payload.ticker, payload.sheet_id_or_url))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# GET DATA
# ============================================
@router.get("/ticker/{ticker}", response_model=TickerData)
def get_ticker_data(
    ticker: str,
    limit: int = 500,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Lee RAW_DATA del ticker desde Google Sheets."""
    t = _validate_ticker(ticker)
    try:
        return sheets.get_raw_data(t, limit=limit)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# STRATEGY 11
# ============================================
@router.post("/strategy/11", response_model=Strategy11Output)
def run_strategy_11(
    params: Strategy11Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 11 - Single Moving Average."""
    t = _validate_ticker(params.ticker)
    params.ticker = t
    data = sheets.get_raw_data(t)
    if len(data.bars) < params.ma_period + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Datos insuficientes: necesito {params.ma_period + 1} barras",
        )
    return strategy_11(data.bars, params)


# ============================================
# STRATEGY 12
# ============================================
@router.post("/strategy/12", response_model=Strategy12Output)
def run_strategy_12(
    params: Strategy12Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 12 - Dual MA + Stop-Loss."""
    t = _validate_ticker(params.ticker)
    params.ticker = t
    data = sheets.get_raw_data(t)
    min_bars = max(params.ma_short_period, params.ma_long_period) + 1
    if len(data.bars) < min_bars:
        raise HTTPException(
            status_code=400,
            detail=f"Datos insuficientes: necesito {min_bars} barras",
        )
    return strategy_12(data.bars, params)


# ============================================
# STRATEGY 13
# ============================================
@router.post("/strategy/13", response_model=Strategy13Output)
def run_strategy_13(
    params: Strategy13Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 13 - Triple MA Filter."""
    t = _validate_ticker(params.ticker)
    params.ticker = t
    data = sheets.get_raw_data(t)
    min_bars = max(params.ma1_period, params.ma2_period, params.ma3_period) + 1
    if len(data.bars) < min_bars:
        raise HTTPException(
            status_code=400,
            detail=f"Datos insuficientes: necesito {min_bars} barras",
        )
    return strategy_13(data.bars, params)


# ============================================
# STRATEGY 14
# ============================================
@router.post("/strategy/14", response_model=Strategy14Output)
def run_strategy_14(
    params: Strategy14Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 14 - Support & Resistance (Pivots)."""
    t = _validate_ticker(params.ticker)
    params.ticker = t
    data = sheets.get_raw_data(t)
    if len(data.bars) < 2:
        raise HTTPException(status_code=400, detail="Necesito al menos 2 barras")
    return strategy_14(data.bars, params)


# ============================================
# STRATEGY 15
# ============================================
@router.post("/strategy/15", response_model=Strategy15Output)
def run_strategy_15(
    params: Strategy15Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 15 - Donchian Channel."""
    t = _validate_ticker(params.ticker)
    params.ticker = t
    data = sheets.get_raw_data(t)
    if len(data.bars) < params.channel_period + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Datos insuficientes: necesito {params.channel_period + 1} barras",
        )
    return strategy_15(data.bars, params)


# ============================================
# STRATEGY 18 - Portfolio
# ============================================
@router.post("/strategy/18", response_model=Strategy18Output)
def run_strategy_18(
    params: Strategy18Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 18 - Portfolio Optimization (Sharpe maximization)."""
    if len(params.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Strategy 18 requiere al menos 2 tickers",
        )

    # Validar y normalizar todos los tickers antes de pegarle a Sheets
    normalized = [_validate_ticker(t) for t in params.tickers]
    params.tickers = normalized

    bars_by_ticker = {}
    for ticker in normalized:
        data = sheets.get_raw_data(ticker, limit=params.lookback_days + 10)
        if len(data.bars) < 30:
            raise HTTPException(
                status_code=400,
                detail=f"Datos insuficientes para {ticker}",
            )
        bars_by_ticker[ticker] = data.bars

    return strategy_18(bars_by_ticker, params)


# ============================================
# CROSS-SECTIONAL #1: PRICE MOMENTUM
# ============================================
@router.post("/cross/momentum", response_model=CrossRankingOutput)
def run_price_momentum(
    params: PriceMomentumInput,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Cross-sectional ranking by cumulative return (paper #1)."""
    if len(params.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Cross-sectional momentum requiere al menos 2 tickers",
        )

    normalized = [_validate_ticker(t) for t in params.tickers]
    params.tickers = normalized

    bars_by_ticker = {}
    needed = params.formation_days + params.skip_days + 1
    for ticker in normalized:
        data = sheets.get_raw_data(ticker, limit=needed + 50)
        bars_by_ticker[ticker] = data.bars

    return price_momentum(bars_by_ticker, params)


# ============================================
# CROSS-SECTIONAL #4: LOW VOLATILITY ANOMALY
# ============================================
@router.post("/cross/low_volatility", response_model=CrossRankingOutput)
def run_low_volatility(
    params: LowVolatilityInput,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Cross-sectional ranking by realized volatility (paper #4)."""
    if len(params.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Cross-sectional low-vol requiere al menos 2 tickers",
        )
    normalized = [_validate_ticker(t) for t in params.tickers]
    params.tickers = normalized

    bars_by_ticker = {}
    needed = params.lookback_days + 1
    for ticker in normalized:
        data = sheets.get_raw_data(ticker, limit=needed + 50)
        bars_by_ticker[ticker] = data.bars

    return low_volatility(bars_by_ticker, params)


# ============================================
# CROSS-SECTIONAL #3: VALUE (B/P)
# ============================================
@router.post("/cross/value", response_model=CrossRankingOutput)
def run_value(
    params: ValueInput,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Cross-sectional ranking by B/P ratio (paper #3)."""
    if len(params.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Cross-sectional value requiere al menos 2 tickers",
        )
    normalized = [_validate_ticker(t) for t in params.tickers]
    params.tickers = normalized

    prices_by_ticker = {}
    fundamentals_by_ticker = {}
    for ticker in normalized:
        # Sólo necesitamos el último close para el ratio
        data = sheets.get_raw_data(ticker, limit=5)
        prices_by_ticker[ticker] = data.bars[-1].close if data.bars else None
        # Y la sheet FUNDAMENTALS (silenciosa si no existe)
        fundamentals_by_ticker[ticker] = sheets.get_fundamentals(ticker)

    return value_strategy(fundamentals_by_ticker, prices_by_ticker, params)


# ============================================
# CROSS-SECTIONAL #6: MULTIFACTOR
# ============================================
@router.post("/cross/multifactor", response_model=CrossRankingOutput)
def run_multifactor(
    params: MultifactorInput,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Combina momentum + low_vol + value en un score promedio (paper #6)."""
    if len(params.tickers) < 2:
        raise HTTPException(
            status_code=400,
            detail="Multifactor requiere al menos 2 tickers",
        )
    normalized = [_validate_ticker(t) for t in params.tickers]
    params.tickers = normalized

    # Una sola fetch de bars + fundamentals + prices para los 3 sub-strategies.
    # max(lookback) = momentum_formation + momentum_skip + buffer
    needed = max(
        params.momentum_formation_days + params.momentum_skip_days,
        params.lowvol_lookback_days,
    ) + 50

    bars_by_ticker = {}
    fundamentals_by_ticker = {}
    prices_by_ticker = {}
    for ticker in normalized:
        data = sheets.get_raw_data(ticker, limit=needed)
        bars_by_ticker[ticker] = data.bars
        prices_by_ticker[ticker] = data.bars[-1].close if data.bars else None
        fundamentals_by_ticker[ticker] = sheets.get_fundamentals(ticker)

    return multifactor(bars_by_ticker, fundamentals_by_ticker, prices_by_ticker, params)


# ============================================
# CROSS-SECTIONAL #8: PAIRS TRADING
# ============================================
@router.post("/cross/pairs", response_model=PairsOutput)
def run_pairs(
    params: PairsInput,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Pairs trading: short el "rich" + long el "cheap" del par (paper #8)."""
    t_a = _validate_ticker(params.ticker_a)
    t_b = _validate_ticker(params.ticker_b)
    if t_a == t_b:
        raise HTTPException(
            status_code=400,
            detail="ticker_a y ticker_b deben ser distintos",
        )
    params.ticker_a = t_a
    params.ticker_b = t_b

    needed = params.lookback_days + 1
    data_a = sheets.get_raw_data(t_a, limit=needed + 50)
    data_b = sheets.get_raw_data(t_b, limit=needed + 50)
    if len(data_a.bars) < needed or len(data_b.bars) < needed:
        raise HTTPException(
            status_code=400,
            detail=f"Datos insuficientes: necesito {needed} bars de cada ticker",
        )

    return pairs_trading(data_a.bars, data_b.bars, params)


# ============================================
# AGGREGATE: Todas las señales
# ============================================
@router.get("/signals/{ticker}", response_model=AllSignals)
def get_all_signals(
    ticker: str,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Calcula las 5 estrategias de signal y devuelve consensus."""
    t = _validate_ticker(ticker)
    data = sheets.get_raw_data(t)

    results = {}
    signals = []

    # Strategy 11
    try:
        out11 = strategy_11(data.bars, Strategy11Input(ticker=t))
        results["strategy_11"] = out11
        signals.append(out11.signal)
    except Exception:
        results["strategy_11"] = None

    # Strategy 12
    try:
        out12 = strategy_12(data.bars, Strategy12Input(ticker=t))
        results["strategy_12"] = out12
        signals.append(out12.signal)
    except Exception:
        results["strategy_12"] = None

    # Strategy 13
    try:
        out13 = strategy_13(data.bars, Strategy13Input(ticker=t))
        results["strategy_13"] = out13
        signals.append(out13.signal)
    except Exception:
        results["strategy_13"] = None

    # Strategy 14
    try:
        out14 = strategy_14(data.bars, Strategy14Input(ticker=t))
        results["strategy_14"] = out14
        signals.append(out14.signal)
    except Exception:
        results["strategy_14"] = None

    # Strategy 15
    try:
        out15 = strategy_15(data.bars, Strategy15Input(ticker=t))
        results["strategy_15"] = out15
        signals.append(out15.signal)
    except Exception:
        results["strategy_15"] = None

    consensus = compute_consensus_signal(signals)

    return AllSignals(
        ticker=t,
        **results,
        consensus_signal=consensus,
        timestamp=datetime.now(),
    )


# ============================================
# UTILITIES
# ============================================
@router.post("/cache/clear")
def clear_cache(sheets: SheetsService = Depends(get_sheets_service)):
    """Limpia el cache de Sheets (forzar refresh)."""
    sheets.clear_cache()
    return {"status": "ok", "message": "Cache limpiado"}
