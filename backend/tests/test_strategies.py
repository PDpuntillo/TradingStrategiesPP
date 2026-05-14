"""
Tests unitarios para las 6 estrategias.
Datos sintéticos, sin Google Sheets.

Run:
    cd backend
    pytest -v
"""
from datetime import datetime, timedelta
from typing import List
import numpy as np
import pytest

from app.models.strategy import (
    PriceBar, SignalType,
    Strategy11Input, Strategy12Input, Strategy13Input,
    Strategy14Input, Strategy15Input, Strategy18Input,
)
from app.services.strategy_service import (
    strategy_11, strategy_12, strategy_13,
    strategy_14, strategy_15, strategy_18,
    simple_moving_average, exponential_moving_average,
    compute_consensus_signal,
)


# ============================================
# FIXTURES
# ============================================
def make_bars(prices: List[float]) -> List[PriceBar]:
    """Crea barras sintéticas a partir de una lista de precios."""
    base_time = datetime(2025, 1, 1)
    return [
        PriceBar(
            timestamp=base_time + timedelta(days=i),
            open=p * 0.99,
            high=p * 1.01,
            low=p * 0.98,
            close=p,
            volume=1000000.0,
        )
        for i, p in enumerate(prices)
    ]


@pytest.fixture
def uptrend_bars():
    """80 barras en uptrend claro: 100 → 150."""
    prices = np.linspace(100, 150, 80).tolist()
    return make_bars(prices)


@pytest.fixture
def downtrend_bars():
    """80 barras en downtrend: 150 → 100."""
    prices = np.linspace(150, 100, 80).tolist()
    return make_bars(prices)


@pytest.fixture
def sideways_bars():
    """80 barras laterales con ruido."""
    np.random.seed(42)
    prices = 100 + np.random.normal(0, 1, 80).cumsum() * 0.1
    return make_bars(prices.tolist())


# ============================================
# TEST: Moving Averages
# ============================================
def test_sma_basic():
    prices = np.array([10, 20, 30, 40, 50])
    assert simple_moving_average(prices, 5) == 30.0
    assert simple_moving_average(prices, 3) == 40.0  # (30+40+50)/3


def test_ema_basic():
    prices = np.array([100, 101, 102, 103, 104])
    ema = exponential_moving_average(prices, 5)
    # EMA debe estar entre el min y max
    assert 100 <= ema <= 104


# ============================================
# TEST: Strategy 11
# ============================================
def test_strategy_11_uptrend(uptrend_bars):
    """En uptrend, precio actual > MA → LONG."""
    params = Strategy11Input(ticker="GGAL", ma_period=20)
    out = strategy_11(uptrend_bars, params)
    assert out.signal == SignalType.LONG
    assert out.current_price > out.ma_value


def test_strategy_11_downtrend(downtrend_bars):
    """En downtrend, precio actual < MA → SHORT."""
    params = Strategy11Input(ticker="GGAL", ma_period=20)
    out = strategy_11(downtrend_bars, params)
    assert out.signal == SignalType.SHORT
    assert out.current_price < out.ma_value


# ============================================
# TEST: Strategy 12
# ============================================
def test_strategy_12_uptrend(uptrend_bars):
    """Uptrend: MA short > MA long → LONG."""
    params = Strategy12Input(
        ticker="GGAL",
        ma_short_period=10,
        ma_long_period=30,
    )
    out = strategy_12(uptrend_bars, params)
    assert out.signal == SignalType.LONG
    assert out.ma_short > out.ma_long


def test_strategy_12_downtrend(downtrend_bars):
    params = Strategy12Input(
        ticker="GGAL",
        ma_short_period=10,
        ma_long_period=30,
    )
    out = strategy_12(downtrend_bars, params)
    assert out.signal == SignalType.SHORT


# ============================================
# TEST: Strategy 13
# ============================================
def test_strategy_13_uptrend(uptrend_bars):
    """Uptrend: MA1 > MA2 > MA3 → LONG."""
    params = Strategy13Input(
        ticker="GGAL",
        ma1_period=3,
        ma2_period=10,
        ma3_period=21,
    )
    out = strategy_13(uptrend_bars, params)
    assert out.signal == SignalType.LONG
    assert out.trend_aligned is True
    assert out.ma1 > out.ma2 > out.ma3


def test_strategy_13_downtrend(downtrend_bars):
    params = Strategy13Input(
        ticker="GGAL",
        ma1_period=3,
        ma2_period=10,
        ma3_period=21,
    )
    out = strategy_13(downtrend_bars, params)
    assert out.signal == SignalType.SHORT
    assert out.trend_aligned is True


# ============================================
# TEST: Strategy 14
# ============================================
def test_strategy_14_pivot_relationship():
    """Pivot debe estar entre support y resistance."""
    bars = make_bars([100, 102])  # high=103.02, low=99.96, close=102
    params = Strategy14Input(ticker="GGAL")
    out = strategy_14(bars, params)
    assert out.support < out.pivot < out.resistance


# ============================================
# TEST: Strategy 15
# ============================================
def test_strategy_15_at_lower_band():
    """Si precio = band_lower → LONG."""
    prices = [100.0] * 19 + [90.0] + [89.5]  # último precio en piso
    bars = make_bars(prices)
    params = Strategy15Input(ticker="GGAL", channel_period=20)
    out = strategy_15(bars, params)
    assert out.signal == SignalType.LONG


def test_strategy_15_at_upper_band():
    """Si precio cerca de band_upper → SHORT."""
    # 20 históricos en 100, uno en 110 (será el upper), precio actual también en 110
    prices = [100.0] * 19 + [110.0] + [110.0]
    bars = make_bars(prices)
    params = Strategy15Input(ticker="GGAL", channel_period=20)
    out = strategy_15(bars, params)
    assert out.signal == SignalType.SHORT


# ============================================
# TEST: Strategy 18 (Portfolio)
# ============================================
def test_strategy_18_weights_normalized(uptrend_bars, downtrend_bars, sideways_bars):
    """Σ |w_i| = 1."""
    bars_by_ticker = {
        "GGAL": uptrend_bars,
        "YPF": downtrend_bars,
        "PAMP": sideways_bars,
    }
    params = Strategy18Input(
        tickers=["GGAL", "YPF", "PAMP"],
        lookback_days=60,
        total_investment=10000.0,
    )
    out = strategy_18(bars_by_ticker, params)
    abs_sum = sum(abs(w.weight) for w in out.weights)
    assert abs(abs_sum - 1.0) < 1e-6


def test_strategy_18_dollar_neutral(uptrend_bars, downtrend_bars, sideways_bars):
    """Si dollar_neutral=True, Σ w_i = 0."""
    bars_by_ticker = {
        "GGAL": uptrend_bars,
        "YPF": downtrend_bars,
        "PAMP": sideways_bars,
    }
    params = Strategy18Input(
        tickers=["GGAL", "YPF", "PAMP"],
        lookback_days=60,
        dollar_neutral=True,
    )
    out = strategy_18(bars_by_ticker, params)
    weight_sum = sum(w.weight for w in out.weights)
    assert abs(weight_sum) < 1e-6


# ============================================
# TEST: Consensus
# ============================================
def test_consensus_majority_long():
    signals = [SignalType.LONG, SignalType.LONG, SignalType.SHORT, SignalType.LONG]
    assert compute_consensus_signal(signals) == SignalType.LONG


def test_consensus_tie():
    signals = [SignalType.LONG, SignalType.SHORT]
    assert compute_consensus_signal(signals) == SignalType.HOLD


def test_consensus_empty():
    assert compute_consensus_signal([]) == SignalType.HOLD


# ============================================
# TEST: Timestamp parser (sheets_service)
# ============================================
# Regresión: GOOGLEFINANCE devuelve M/D/Y, NO D/M/Y. Si el orden de
# formatos en _parse_timestamp se invierte, fechas con día <=12 se
# interpretan al revés sin error.
def test_parse_timestamp_googlefinance_us_format():
    from app.services.sheets_service import SheetsService

    # Casos ambiguos (día y mes ambos <=12) — regresión clave
    assert SheetsService._parse_timestamp("3/11/2025 17:00:00").month == 3   # Mar 11
    assert SheetsService._parse_timestamp("3/11/2025 17:00:00").day == 11
    assert SheetsService._parse_timestamp("3/12/2025 17:00:00").month == 3   # Mar 12
    assert SheetsService._parse_timestamp("11/2/2025 17:00:00").month == 11  # Nov 2
    assert SheetsService._parse_timestamp("11/2/2025 17:00:00").day == 2

    # Casos no ambiguos (día > 12) — ya andaban antes
    assert SheetsService._parse_timestamp("3/13/2025 17:00:00").month == 3
    assert SheetsService._parse_timestamp("5/13/2025 17:00:00").day == 13

    # ISO format (legacy)
    iso = SheetsService._parse_timestamp("2025-03-11 17:00:00")
    assert iso.month == 3 and iso.day == 11
