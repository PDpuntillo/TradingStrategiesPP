"""
Schemas Pydantic para las 6 estrategias del paper Kakushadze.
Define inputs, outputs y signals de cada estrategia.
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SignalType(str, Enum):
    """Tipos de señales que pueden generar las estrategias."""
    LONG = "LONG"
    SHORT = "SHORT"
    HOLD = "HOLD"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"


class Ticker(str, Enum):
    """Tickers soportados en MVP."""
    GGAL = "GGAL"
    YPF = "YPF"
    PAMP = "PAMP"


# ============================================
# PRICE DATA (input común para todas)
# ============================================
class PriceBar(BaseModel):
    """Una barra de precio (OHLCV)."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class TickerData(BaseModel):
    """Datos completos de un ticker."""
    ticker: Ticker
    bars: List[PriceBar]
    last_updated: datetime


# ============================================
# STRATEGY 11: Single Moving Average
# ============================================
class Strategy11Input(BaseModel):
    """Input para Strategy 11 (Single MA)."""
    ticker: Ticker
    ma_period: int = Field(default=20, ge=2, le=200)
    ma_type: str = Field(default="SMA", pattern="^(SMA|EMA)$")


class Strategy11Output(BaseModel):
    """Output de Strategy 11."""
    ticker: Ticker
    current_price: float
    ma_value: float
    ma_period: int
    ma_type: str
    signal: SignalType
    timestamp: datetime


# ============================================
# STRATEGY 12: Two Moving Averages + Stop-Loss
# ============================================
class Strategy12Input(BaseModel):
    """Input para Strategy 12 (Dual MA + stop)."""
    ticker: Ticker
    ma_short_period: int = Field(default=10, ge=2, le=50)
    ma_long_period: int = Field(default=30, ge=10, le=200)
    stop_loss_pct: float = Field(default=0.02, ge=0.001, le=0.1)


class Strategy12Output(BaseModel):
    """Output de Strategy 12."""
    ticker: Ticker
    current_price: float
    ma_short: float
    ma_long: float
    previous_close: float
    signal: SignalType
    stop_loss_triggered: bool
    timestamp: datetime


# ============================================
# STRATEGY 13: Three Moving Averages (Filter)
# ============================================
class Strategy13Input(BaseModel):
    """Input para Strategy 13 (Triple MA)."""
    ticker: Ticker
    ma1_period: int = Field(default=3, ge=2, le=20)
    ma2_period: int = Field(default=10, ge=5, le=50)
    ma3_period: int = Field(default=21, ge=10, le=200)


class Strategy13Output(BaseModel):
    """Output de Strategy 13."""
    ticker: Ticker
    current_price: float
    ma1: float
    ma2: float
    ma3: float
    trend_aligned: bool
    signal: SignalType
    timestamp: datetime


# ============================================
# STRATEGY 14: Support & Resistance (Pivots)
# ============================================
class Strategy14Input(BaseModel):
    """Input para Strategy 14 (Pivot points)."""
    ticker: Ticker


class Strategy14Output(BaseModel):
    """Output de Strategy 14."""
    ticker: Ticker
    current_price: float
    pivot: float
    resistance: float
    support: float
    signal: SignalType
    timestamp: datetime


# ============================================
# STRATEGY 15: Donchian Channel
# ============================================
class Strategy15Input(BaseModel):
    """Input para Strategy 15 (Donchian)."""
    ticker: Ticker
    channel_period: int = Field(default=20, ge=5, le=100)


class Strategy15Output(BaseModel):
    """Output de Strategy 15."""
    ticker: Ticker
    current_price: float
    band_upper: float
    band_lower: float
    channel_width: float
    signal: SignalType
    timestamp: datetime


# ============================================
# STRATEGY 18: Portfolio Optimization
# ============================================
class Strategy18Input(BaseModel):
    """Input para Strategy 18 (Sharpe maximization)."""
    tickers: List[Ticker]
    lookback_days: int = Field(default=252, ge=30, le=1000)
    dollar_neutral: bool = Field(default=False)
    total_investment: float = Field(default=10000.0, gt=0)


class PortfolioWeight(BaseModel):
    """Peso de un ticker en el portfolio óptimo."""
    ticker: Ticker
    weight: float
    dollar_position: float
    expected_return: float
    volatility: float


class Strategy18Output(BaseModel):
    """Output de Strategy 18."""
    weights: List[PortfolioWeight]
    portfolio_return: float
    portfolio_volatility: float
    sharpe_ratio: float
    dollar_neutral: bool
    total_investment: float
    timestamp: datetime


# ============================================
# AGGREGATE: Todas las señales por ticker
# ============================================
class AllSignals(BaseModel):
    """Resumen de todas las señales para un ticker."""
    ticker: Ticker
    strategy_11: Optional[Strategy11Output] = None
    strategy_12: Optional[Strategy12Output] = None
    strategy_13: Optional[Strategy13Output] = None
    strategy_14: Optional[Strategy14Output] = None
    strategy_15: Optional[Strategy15Output] = None
    consensus_signal: SignalType
    timestamp: datetime
