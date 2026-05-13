"""
Endpoints REST para las 6 estrategias del paper.
"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from app.models.strategy import (
    Ticker,
    TickerData,
    AllSignals,
    Strategy11Input, Strategy11Output,
    Strategy12Input, Strategy12Output,
    Strategy13Input, Strategy13Output,
    Strategy14Input, Strategy14Output,
    Strategy15Input, Strategy15Output,
    Strategy18Input, Strategy18Output,
)
from app.services.sheets_service import SheetsService, get_sheets_service
from app.services.strategy_service import (
    strategy_11, strategy_12, strategy_13,
    strategy_14, strategy_15, strategy_18,
    compute_consensus_signal,
)


router = APIRouter(prefix="/api", tags=["strategies"])


# ============================================
# GET DATA
# ============================================
@router.get("/ticker/{ticker}", response_model=TickerData)
def get_ticker_data(
    ticker: Ticker,
    limit: int = 500,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Lee RAW_DATA del ticker desde Google Sheets."""
    try:
        return sheets.get_raw_data(ticker, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickers", response_model=List[Ticker])
def list_tickers():
    """Lista de tickers disponibles."""
    return list(Ticker)


# ============================================
# STRATEGY 11
# ============================================
@router.post("/strategy/11", response_model=Strategy11Output)
def run_strategy_11(
    params: Strategy11Input,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Strategy 11 - Single Moving Average."""
    data = sheets.get_raw_data(params.ticker)
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
    data = sheets.get_raw_data(params.ticker)
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
    data = sheets.get_raw_data(params.ticker)
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
    data = sheets.get_raw_data(params.ticker)
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
    data = sheets.get_raw_data(params.ticker)
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
    bars_by_ticker = {}
    for ticker in params.tickers:
        data = sheets.get_raw_data(ticker, limit=params.lookback_days + 10)
        if len(data.bars) < 30:
            raise HTTPException(
                status_code=400,
                detail=f"Datos insuficientes para {ticker.value}",
            )
        bars_by_ticker[ticker] = data.bars

    return strategy_18(bars_by_ticker, params)


# ============================================
# AGGREGATE: Todas las señales
# ============================================
@router.get("/signals/{ticker}", response_model=AllSignals)
def get_all_signals(
    ticker: Ticker,
    sheets: SheetsService = Depends(get_sheets_service),
):
    """Calcula las 5 estrategias de signal y devuelve consensus."""
    data = sheets.get_raw_data(ticker)

    results = {}
    signals = []

    # Strategy 11
    try:
        out11 = strategy_11(data.bars, Strategy11Input(ticker=ticker))
        results["strategy_11"] = out11
        signals.append(out11.signal)
    except Exception:
        results["strategy_11"] = None

    # Strategy 12
    try:
        out12 = strategy_12(data.bars, Strategy12Input(ticker=ticker))
        results["strategy_12"] = out12
        signals.append(out12.signal)
    except Exception:
        results["strategy_12"] = None

    # Strategy 13
    try:
        out13 = strategy_13(data.bars, Strategy13Input(ticker=ticker))
        results["strategy_13"] = out13
        signals.append(out13.signal)
    except Exception:
        results["strategy_13"] = None

    # Strategy 14
    try:
        out14 = strategy_14(data.bars, Strategy14Input(ticker=ticker))
        results["strategy_14"] = out14
        signals.append(out14.signal)
    except Exception:
        results["strategy_14"] = None

    # Strategy 15
    try:
        out15 = strategy_15(data.bars, Strategy15Input(ticker=ticker))
        results["strategy_15"] = out15
        signals.append(out15.signal)
    except Exception:
        results["strategy_15"] = None

    consensus = compute_consensus_signal(signals)

    return AllSignals(
        ticker=ticker,
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
