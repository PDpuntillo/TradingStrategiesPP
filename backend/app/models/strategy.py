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


# Ticker es un alias de str — la lista válida es dinámica y se valida
# en runtime contra settings.spreadsheet_ids_map (ver sheets_service).
# Mantener como str (no Enum) permite agregar tickers sin cambios de código.
Ticker = str


class TickerInfo(BaseModel):
    """Metadata de un ticker para el frontend (nombre display, sector, etc)."""
    ticker: str
    name: str
    sector: Optional[str] = None
    currency: str = "ARS"


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
    # Default 504 días = ~2 años de trading; máximo 5 años. La estimación
    # de covarianza Sharpe-max es mucho más estable con ventanas largas
    # (con 1 año hay demasiado peso de eventos cortos).
    lookback_days: int = Field(default=504, ge=30, le=1260)
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


# ============================================
# CROSS-SECTIONAL STRATEGIES (paper sections #1-10)
# ============================================
# Estrategias que rankean tickers entre sí (no per-ticker individual).
# Output común: lista de items con factor_value, rank, decile, signal.

class CrossRankingItem(BaseModel):
    """Una entry en un ranking cross-sectional."""
    ticker: Ticker
    factor_value: Optional[float]   # el valor del factor (return, vol, B/P, etc.)
    rank: Optional[int]             # 1 = mejor, N = peor (depende del strategy)
    decile: Optional[int]           # 1..10. None si insuf data.
    signal: SignalType              # LONG si top decile, SHORT si bottom, HOLD el resto


class CrossRankingOutput(BaseModel):
    """Output común de las estrategias cross-sectional de tipo ranking."""
    strategy_name: str              # "price_momentum", "low_volatility", "value", etc.
    description: str                # human-readable
    items: List[CrossRankingItem]
    n_tickers: int                  # cuántos tickers efectivamente rankeados
    n_skipped: int                  # cuántos sin data suficiente
    timestamp: datetime


class PriceMomentumInput(BaseModel):
    """Input para Price Momentum (paper #1)."""
    tickers: List[Ticker]
    # T = formation period en días de trading (default 6 meses ≈ 126)
    formation_days: int = Field(default=126, ge=21, le=504)
    # S = skip period en días — convención común: skipear el último mes
    # para evitar el short-term reversal effect (Jegadeesh-Titman).
    skip_days: int = Field(default=21, ge=0, le=63)
    # Si True, ajusta por volatilidad: rank por R_mean / sigma en vez de R_cum.
    risk_adjusted: bool = Field(default=False)


class LowVolatilityInput(BaseModel):
    """Input para Low Volatility Anomaly (paper #4)."""
    tickers: List[Ticker]
    # Ventana para estimar la volatilidad. 6-12 meses es el rango típico.
    lookback_days: int = Field(default=126, ge=21, le=504)
    # Si True, anualiza la vol (sqrt(252) * daily_std). Solo afecta el display.
    annualized: bool = Field(default=True)


class ValueInput(BaseModel):
    """Input para Value (paper #3)."""
    tickers: List[Ticker]
    # Métrica a usar como ratio B/P. Por default lee 'BookValuePerShare'
    # de la sheet FUNDAMENTALS de cada ticker y lo divide por current price.
    book_value_metric: str = "BookValuePerShare"


class MultifactorInput(BaseModel):
    """Input para Multifactor portfolio (paper #6)."""
    tickers: List[Ticker]
    # Toggles para incluir/excluir cada factor del combined score
    include_momentum: bool = True
    include_low_volatility: bool = True
    include_value: bool = True
    # Params de los sub-strategies (defaults razonables)
    momentum_formation_days: int = Field(default=126, ge=21, le=504)
    momentum_skip_days: int = Field(default=21, ge=0, le=63)
    lowvol_lookback_days: int = Field(default=126, ge=21, le=504)


class PairsInput(BaseModel):
    """Input para Pairs Trading (paper #8)."""
    ticker_a: Ticker
    ticker_b: Ticker
    # Ventana para computar el demeaned return (3 meses default)
    lookback_days: int = Field(default=63, ge=21, le=504)
    total_investment: float = Field(default=10000.0, gt=0)


class PairsPosition(BaseModel):
    """Posición de un ticker dentro del par."""
    ticker: Ticker
    log_return: float
    demeaned_return: float
    dollar_position: float        # signed: positive=long, negative=short
    signal: SignalType


class PairsOutput(BaseModel):
    """Output de Pairs Trading."""
    strategy_name: str = "pairs_trading"
    ticker_a: Ticker
    ticker_b: Ticker
    correlation: float            # para contexto: qué tan correlacionado es el par
    lookback_days: int
    mean_return: float
    positions: List[PairsPosition]   # exactamente 2 items
    total_investment: float
    timestamp: datetime


class MeanReversionInput(BaseModel):
    """Input para Mean Reversion (paper #9 single, #10 multiple clusters)."""
    tickers: List[Ticker]
    lookback_days: int = Field(default=63, ge=21, le=504)
    total_investment: float = Field(default=10000.0, gt=0)
    # Si True, agrupa tickers por sector (de tickers_meta.json) — paper #10
    # Si False, trata todos como un único cluster — paper #9
    use_clusters: bool = False


class MeanReversionPosition(BaseModel):
    """Posición de un ticker en mean-reversion."""
    ticker: Ticker
    cluster: Optional[str] = None     # sector si use_clusters=True
    log_return: float
    demeaned_return: float            # R_i - mean del cluster
    dollar_position: float            # signed: positive=long, negative=short
    signal: SignalType


class MeanReversionOutput(BaseModel):
    """Output de Mean Reversion."""
    strategy_name: str = "mean_reversion"
    use_clusters: bool
    n_clusters: int
    n_tickers: int                    # rankeados (con datos)
    n_skipped: int                    # sin data
    lookback_days: int
    total_investment: float
    positions: List[MeanReversionPosition]
    timestamp: datetime
