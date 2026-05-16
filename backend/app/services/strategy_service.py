"""
Lógica pura de las 6 estrategias del paper Kakushadze & Serur (2018).

Estrategias implementadas:
    11 - Single Moving Average
    12 - Two Moving Averages + Stop-Loss
    13 - Three Moving Averages (Filter)
    14 - Support & Resistance (Pivot Points)
    15 - Donchian Channel
    18 - Portfolio Optimization (Sharpe maximization)

Cada función toma datos numéricos puros y retorna una señal.
NO depende de Google Sheets ni de FastAPI (testeable de forma aislada).
"""
from datetime import datetime
from typing import List, Tuple
import numpy as np
import pandas as pd
from scipy import optimize

from app.models.strategy import (
    SignalType,
    Ticker,
    PriceBar,
    Strategy11Input, Strategy11Output,
    Strategy12Input, Strategy12Output,
    Strategy13Input, Strategy13Output,
    Strategy14Input, Strategy14Output,
    Strategy15Input, Strategy15Output,
    Strategy18Input, Strategy18Output,
    PortfolioWeight,
    CrossRankingItem, CrossRankingOutput,
    PriceMomentumInput,
    LowVolatilityInput,
    ValueInput,
    MultifactorInput,
    PairsInput,
    PairsPosition, PairsOutput,
    MeanReversionInput,
    MeanReversionPosition, MeanReversionOutput,
)


# ============================================
# HELPERS: Moving Averages
# ============================================
def simple_moving_average(prices: np.ndarray, period: int) -> float:
    """SMA del último período."""
    if len(prices) < period:
        raise ValueError(f"Necesito al menos {period} precios, tengo {len(prices)}")
    return float(np.mean(prices[-period:]))


def exponential_moving_average(prices: np.ndarray, period: int, lambda_factor: float = 0.94) -> float:
    """
    EMA con lambda decay (eq. 320 del paper).
    EMA(T, λ) = (1-λ) / (1-λ^T) × Σ λ^(t-1) × P(t)
    """
    if len(prices) < period:
        raise ValueError(f"Necesito al menos {period} precios, tengo {len(prices)}")

    recent = prices[-period:][::-1]  # más reciente primero
    weights = np.array([lambda_factor ** t for t in range(period)])
    numerator = np.sum(weights * recent)
    denominator = np.sum(weights)
    return float(numerator / denominator)


def compute_ma(prices: np.ndarray, period: int, ma_type: str = "SMA") -> float:
    """Wrapper que elige SMA o EMA según el tipo."""
    if ma_type == "SMA":
        return simple_moving_average(prices, period)
    elif ma_type == "EMA":
        return exponential_moving_average(prices, period)
    else:
        raise ValueError(f"Tipo de MA no soportado: {ma_type}")


# ============================================
# STRATEGY 11: Single Moving Average
# ============================================
def strategy_11(
    bars: List[PriceBar],
    params: Strategy11Input,
) -> Strategy11Output:
    """
    Strategy 11 - Single MA (eq. 321):
        Signal = LONG if P > MA(T)
        Signal = SHORT if P < MA(T)
    """
    prices = np.array([b.close for b in bars])
    current_price = float(prices[-1])
    ma_value = compute_ma(prices[:-1], params.ma_period, params.ma_type)  # MA sin el precio actual

    if current_price > ma_value:
        signal = SignalType.LONG
    elif current_price < ma_value:
        signal = SignalType.SHORT
    else:
        signal = SignalType.HOLD

    return Strategy11Output(
        ticker=params.ticker,
        current_price=current_price,
        ma_value=ma_value,
        ma_period=params.ma_period,
        ma_type=params.ma_type,
        signal=signal,
        timestamp=datetime.now(),
    )


# ============================================
# STRATEGY 12: Two MA + Stop-Loss
# ============================================
def strategy_12(
    bars: List[PriceBar],
    params: Strategy12Input,
) -> Strategy12Output:
    """
    Strategy 12 - Dual MA con stop-loss (eq. 323):
        LONG si MA(T') > MA(T)
        Liquidate LONG si P < (1 - Δ) × P_prev
        SHORT si MA(T') < MA(T)
        Liquidate SHORT si P > (1 + Δ) × P_prev
    """
    prices = np.array([b.close for b in bars])
    current_price = float(prices[-1])
    previous_close = float(prices[-2])

    ma_short = simple_moving_average(prices[:-1], params.ma_short_period)
    ma_long = simple_moving_average(prices[:-1], params.ma_long_period)

    stop_long_triggered = current_price < (1 - params.stop_loss_pct) * previous_close
    stop_short_triggered = current_price > (1 + params.stop_loss_pct) * previous_close

    if stop_long_triggered:
        signal = SignalType.EXIT_LONG
        stop_triggered = True
    elif stop_short_triggered:
        signal = SignalType.EXIT_SHORT
        stop_triggered = True
    elif ma_short > ma_long:
        signal = SignalType.LONG
        stop_triggered = False
    elif ma_short < ma_long:
        signal = SignalType.SHORT
        stop_triggered = False
    else:
        signal = SignalType.HOLD
        stop_triggered = False

    return Strategy12Output(
        ticker=params.ticker,
        current_price=current_price,
        ma_short=ma_short,
        ma_long=ma_long,
        previous_close=previous_close,
        signal=signal,
        stop_loss_triggered=stop_triggered,
        timestamp=datetime.now(),
    )


# ============================================
# STRATEGY 13: Three MA Filter
# ============================================
def strategy_13(
    bars: List[PriceBar],
    params: Strategy13Input,
) -> Strategy13Output:
    """
    Strategy 13 - Triple MA filter (eq. 324):
        LONG si MA(T1) > MA(T2) > MA(T3)
        SHORT si MA(T1) < MA(T2) < MA(T3)
        HOLD si no hay alineación
    """
    prices = np.array([b.close for b in bars])
    current_price = float(prices[-1])

    ma1 = simple_moving_average(prices[:-1], params.ma1_period)
    ma2 = simple_moving_average(prices[:-1], params.ma2_period)
    ma3 = simple_moving_average(prices[:-1], params.ma3_period)

    if ma1 > ma2 > ma3:
        signal = SignalType.LONG
        trend_aligned = True
    elif ma1 < ma2 < ma3:
        signal = SignalType.SHORT
        trend_aligned = True
    elif ma1 <= ma2:                 # corta cruza por debajo de la intermedia → exit long
        signal = SignalType.EXIT_LONG
        trend_aligned = False
    elif ma1 >= ma2:                 # corta cruza por encima de la intermedia → exit short
        signal = SignalType.EXIT_SHORT
        trend_aligned = False
    else:
        # inalcanzable con las dos condiciones anteriores cubriendo todo el dominio,
        # se deja por defensa.
        signal = SignalType.HOLD
        trend_aligned = False

    return Strategy13Output(
        ticker=params.ticker,
        current_price=current_price,
        ma1=ma1,
        ma2=ma2,
        ma3=ma3,
        trend_aligned=trend_aligned,
        signal=signal,
        timestamp=datetime.now(),
    )


# ============================================
# STRATEGY 14: Support & Resistance (Pivots)
# ============================================
def strategy_14(
    bars: List[PriceBar],
    params: Strategy14Input,
) -> Strategy14Output:
    """
    Strategy 14 - Pivot points (eqs. 325-328):
        C = (H + L + Cl) / 3        (pivot del día anterior)
        R = 2*C - L                  (resistencia)
        S = 2*C - H                  (soporte)

        LONG si P > C
        Liquidate LONG si P >= R
        SHORT si P < C
        Liquidate SHORT si P <= S
    """
    if len(bars) < 2:
        raise ValueError("Strategy 14 necesita al menos 2 barras")

    previous_bar = bars[-2]
    current_price = float(bars[-1].close)

    pivot = (previous_bar.high + previous_bar.low + previous_bar.close) / 3
    resistance = 2 * pivot - previous_bar.low
    support = 2 * pivot - previous_bar.high

    if current_price >= resistance:
        signal = SignalType.EXIT_LONG
    elif current_price <= support:
        signal = SignalType.EXIT_SHORT
    elif current_price > pivot:
        signal = SignalType.LONG
    elif current_price < pivot:
        signal = SignalType.SHORT
    else:
        signal = SignalType.HOLD

    return Strategy14Output(
        ticker=params.ticker,
        current_price=current_price,
        pivot=float(pivot),
        resistance=float(resistance),
        support=float(support),
        signal=signal,
        timestamp=datetime.now(),
    )


# ============================================
# STRATEGY 15: Donchian Channel
# ============================================
def strategy_15(
    bars: List[PriceBar],
    params: Strategy15Input,
) -> Strategy15Output:
    """
    Strategy 15 - Donchian Channel (eqs. 329-331):
        B_up = max(P(1), ..., P(T))
        B_down = min(P(1), ..., P(T))

        LONG / Liquidate SHORT si P = B_down (rebote desde piso)
        SHORT / Liquidate LONG si P = B_up (rebote desde techo)
    """
    prices = np.array([b.close for b in bars])
    if len(prices) < params.channel_period + 1:
        raise ValueError(f"Necesito al menos {params.channel_period + 1} barras")

    current_price = float(prices[-1])
    window = prices[-(params.channel_period + 1):-1]  # excluye precio actual

    band_upper = float(np.max(window))
    band_lower = float(np.min(window))
    channel_width = band_upper - band_lower

    # Tolerancia: 0.5% del ancho del canal para considerar "tocó la banda"
    tolerance = channel_width * 0.005

    if current_price <= band_lower + tolerance:
        signal = SignalType.LONG  # rebote desde piso
    elif current_price >= band_upper - tolerance:
        signal = SignalType.SHORT  # rebote desde techo
    else:
        signal = SignalType.HOLD

    return Strategy15Output(
        ticker=params.ticker,
        current_price=current_price,
        band_upper=band_upper,
        band_lower=band_lower,
        channel_width=channel_width,
        signal=signal,
        timestamp=datetime.now(),
    )


# ============================================
# STRATEGY 18: Portfolio Optimization
# ============================================
def _compute_returns(bars: List[PriceBar]) -> np.ndarray:
    """Calcula log-returns diarios."""
    prices = np.array([b.close for b in bars])
    return np.log(prices[1:] / prices[:-1])


def strategy_18(
    bars_by_ticker: dict[Ticker, List[PriceBar]],
    params: Strategy18Input,
) -> Strategy18Output:
    """
    Strategy 18 - Portfolio Optimization (eqs. 342-358):

    Maximiza Sharpe ratio o minimiza el quadratic objective:
        g(w, λ) = (λ/2) Σ C_ij w_i w_j - Σ E_i w_i

    Sujeto a: Σ |w_i| = 1
              Σ w_i = 0  (si dollar_neutral=True)

    Solución analítica:
        w_i = (1/λ) [Σ C^(-1)_ij E_j  -  μ × Σ C^(-1)_ij]  (si dollar_neutral)
        w_i = (1/λ) Σ C^(-1)_ij E_j                        (si no)
    """
    tickers = params.tickers
    n = len(tickers)

    # 1. Construir matriz de retornos: cada columna = ticker
    returns_matrix = []
    expected_returns = []
    volatilities = []

    for ticker in tickers:
        bars = bars_by_ticker.get(ticker)
        if not bars or len(bars) < 30:
            raise ValueError(f"Datos insuficientes para {ticker}")

        # Tomar lookback_days
        bars_window = bars[-params.lookback_days:]
        returns = _compute_returns(bars_window)
        returns_matrix.append(returns)
        expected_returns.append(np.mean(returns))
        volatilities.append(np.std(returns, ddof=1))

    # Alinear longitudes (usar la mínima)
    min_len = min(len(r) for r in returns_matrix)
    returns_aligned = np.array([r[-min_len:] for r in returns_matrix])  # shape (n, T)

    expected_returns = np.array(expected_returns)
    volatilities = np.array(volatilities)

    # 2. Matriz de covarianza
    cov_matrix = np.cov(returns_aligned, ddof=1)  # shape (n, n)

    # 3. Optimización
    # Regularización por estabilidad numérica
    cov_matrix_reg = cov_matrix + np.eye(n) * 1e-8
    cov_inv = np.linalg.inv(cov_matrix_reg)

    if params.dollar_neutral:
        # Eq. 358: w_i = (1/λ) [C^(-1) E - μ × C^(-1) × 1] (dollar-neutral)
        ones = np.ones(n)
        cov_inv_E = cov_inv @ expected_returns
        cov_inv_ones = cov_inv @ ones

        # μ = (1' C^(-1) E) / (1' C^(-1) 1)
        mu = (ones @ cov_inv_E) / (ones @ cov_inv_ones)
        raw_weights = cov_inv_E - mu * cov_inv_ones
    else:
        # Eq. 353: w_i = (1/λ) C^(-1) E  (long-only, sin constraint dollar-neutral)
        raw_weights = cov_inv @ expected_returns

    # Normalización: Σ |w_i| = 1
    abs_sum = np.sum(np.abs(raw_weights))
    if abs_sum < 1e-10:
        # Fallback a pesos iguales
        weights = np.ones(n) / n
    else:
        weights = raw_weights / abs_sum

    # 4. Métricas del portfolio
    portfolio_return = float(weights @ expected_returns)
    portfolio_variance = float(weights @ cov_matrix @ weights)
    portfolio_volatility = float(np.sqrt(portfolio_variance))
    sharpe_ratio = (
        portfolio_return / portfolio_volatility if portfolio_volatility > 1e-10 else 0.0
    )

    # 5. Build output
    portfolio_weights: List[PortfolioWeight] = []
    for i, ticker in enumerate(tickers):
        portfolio_weights.append(
            PortfolioWeight(
                ticker=ticker,
                weight=float(weights[i]),
                dollar_position=float(weights[i] * params.total_investment),
                expected_return=float(expected_returns[i]),
                volatility=float(volatilities[i]),
            )
        )

    return Strategy18Output(
        weights=portfolio_weights,
        portfolio_return=portfolio_return,
        portfolio_volatility=portfolio_volatility,
        sharpe_ratio=sharpe_ratio,
        dollar_neutral=params.dollar_neutral,
        total_investment=params.total_investment,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL HELPERS
# ============================================
def _assign_deciles_and_signals(items_sorted_desc: List[CrossRankingItem]) -> None:
    """
    Asigna decile (1..10) y signal (LONG/SHORT/HOLD) in-place.
    Asume items ordenados descendentemente por factor (1 = mejor).

    - Decile 1 (top 10%) → LONG
    - Decile 10 (bottom 10%) → SHORT
    - Resto → HOLD

    Si hay <10 tickers, usa quintiles: top 20% LONG, bottom 20% SHORT.
    Si hay <5, top 1 LONG, bottom 1 SHORT, resto HOLD.
    """
    n = len(items_sorted_desc)
    if n == 0:
        return

    if n >= 10:
        size = max(1, n // 10)  # ~10% por decile
        long_cutoff = size
        short_cutoff = n - size
    elif n >= 5:
        size = max(1, n // 5)
        long_cutoff = size
        short_cutoff = n - size
    else:
        long_cutoff = 1
        short_cutoff = n - 1

    for i, item in enumerate(items_sorted_desc):
        item.rank = i + 1
        # decile aproximado para todos
        item.decile = min(10, int(10 * i / n) + 1)
        if i < long_cutoff:
            item.signal = SignalType.LONG
        elif i >= short_cutoff:
            item.signal = SignalType.SHORT
        else:
            item.signal = SignalType.HOLD


# ============================================
# CROSS-SECTIONAL #1: PRICE MOMENTUM
# ============================================
def price_momentum(
    bars_by_ticker: dict,
    params: PriceMomentumInput,
) -> CrossRankingOutput:
    """
    Paper #1 — Price Momentum.

    Para cada ticker calcula el cumulative return de los últimos T días,
    skippeando los últimos S días (Jegadeesh-Titman convention para evitar
    short-term reversal).

    Si risk_adjusted=True, divide por la volatilidad del período (Sharpe-like).

    Rankea descendentemente (mayor return → mayor rank → top decile = LONG).
    """
    items: List[CrossRankingItem] = []
    n_skipped = 0

    formation = params.formation_days
    skip = params.skip_days
    needed = formation + skip + 1  # bars necesarios

    for ticker, bars in bars_by_ticker.items():
        if len(bars) < needed:
            items.append(CrossRankingItem(
                ticker=ticker,
                factor_value=None,
                rank=None,
                decile=None,
                signal=SignalType.HOLD,
            ))
            n_skipped += 1
            continue

        closes = np.array([b.close for b in bars], dtype=float)
        # Ventana: hasta el bar -skip (exclusivo), formation bars hacia atrás.
        end_idx = len(closes) - skip
        start_idx = end_idx - formation
        # Cumulative return entre start y end-1
        p_start = closes[start_idx]
        p_end = closes[end_idx - 1]
        cum_return = (p_end / p_start) - 1.0 if p_start > 0 else 0.0

        if params.risk_adjusted:
            window = closes[start_idx:end_idx]
            rets = np.diff(window) / window[:-1]
            sigma = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
            factor = (cum_return / sigma) if sigma > 0 else 0.0
        else:
            factor = cum_return

        items.append(CrossRankingItem(
            ticker=ticker,
            factor_value=float(factor),
            rank=None,
            decile=None,
            signal=SignalType.HOLD,
        ))

    # Separar los con data y sin data, rankear solo los válidos
    with_data = [it for it in items if it.factor_value is not None]
    without_data = [it for it in items if it.factor_value is None]
    with_data.sort(key=lambda it: it.factor_value, reverse=True)  # desc
    _assign_deciles_and_signals(with_data)

    # Devolver: primero los rankeados, después los skippeados
    final_items = with_data + without_data

    return CrossRankingOutput(
        strategy_name="price_momentum",
        description=f"Cumulative return last {formation}d, skip {skip}d"
                    + (" (risk-adjusted)" if params.risk_adjusted else ""),
        items=final_items,
        n_tickers=len(with_data),
        n_skipped=n_skipped,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL #4: LOW VOLATILITY ANOMALY
# ============================================
def low_volatility(
    bars_by_ticker: dict,
    params: LowVolatilityInput,
) -> CrossRankingOutput:
    """
    Paper #4 — Low Volatility Anomaly.

    Para cada ticker calcula la vol histórica de los daily returns sobre
    `lookback_days`. Rankea ASCENDENTE (menor vol → mejor rank), porque
    el "anomaly" es que low-vol stocks outperforman.

    LONG el top decile (low-vol) / SHORT el bottom decile (high-vol).
    """
    items: List[CrossRankingItem] = []
    n_skipped = 0
    needed = params.lookback_days + 1
    ann_factor = np.sqrt(252.0) if params.annualized else 1.0

    for ticker, bars in bars_by_ticker.items():
        if len(bars) < needed:
            items.append(CrossRankingItem(
                ticker=ticker, factor_value=None, rank=None,
                decile=None, signal=SignalType.HOLD,
            ))
            n_skipped += 1
            continue

        closes = np.array([b.close for b in bars[-needed:]], dtype=float)
        rets = np.diff(closes) / closes[:-1]
        sigma = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
        items.append(CrossRankingItem(
            ticker=ticker,
            factor_value=sigma * ann_factor,
            rank=None, decile=None, signal=SignalType.HOLD,
        ))

    # Rankear ASCENDENTE: menor vol → mejor (rank 1)
    with_data = [it for it in items if it.factor_value is not None]
    without_data = [it for it in items if it.factor_value is None]
    with_data.sort(key=lambda it: it.factor_value)  # asc
    _assign_deciles_and_signals(with_data)
    final_items = with_data + without_data

    return CrossRankingOutput(
        strategy_name="low_volatility",
        description=f"Realized {('annualized ' if params.annualized else '')}volatility last {params.lookback_days}d — anomaly: low-vol stocks outperform",
        items=final_items,
        n_tickers=len(with_data),
        n_skipped=n_skipped,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL #3: VALUE (B/P)
# ============================================
def value_strategy(
    fundamentals_by_ticker: dict,
    prices_by_ticker: dict,
    params: ValueInput,
) -> CrossRankingOutput:
    """
    Paper #3 — Value.

    Factor: B/P = BookValuePerShare / current_price.

    Rankea descendente (mayor B/P → ticker más "value/cheap" → top decile
    = LONG, bottom = SHORT). Tickers sin BookValuePerShare en su
    FUNDAMENTALS sheet aparecen como skipped.

    fundamentals_by_ticker: {ticker: {metric: value}}
    prices_by_ticker:       {ticker: last_close_float}
    """
    items: List[CrossRankingItem] = []
    n_skipped = 0

    for ticker, price in prices_by_ticker.items():
        fundamentals = fundamentals_by_ticker.get(ticker, {})
        book = fundamentals.get(params.book_value_metric)
        if book is None or price is None or price <= 0:
            items.append(CrossRankingItem(
                ticker=ticker, factor_value=None, rank=None,
                decile=None, signal=SignalType.HOLD,
            ))
            n_skipped += 1
            continue
        bp_ratio = float(book) / float(price)
        items.append(CrossRankingItem(
            ticker=ticker,
            factor_value=bp_ratio,
            rank=None, decile=None, signal=SignalType.HOLD,
        ))

    with_data = [it for it in items if it.factor_value is not None]
    without_data = [it for it in items if it.factor_value is None]
    with_data.sort(key=lambda it: it.factor_value, reverse=True)  # desc
    _assign_deciles_and_signals(with_data)
    final_items = with_data + without_data

    return CrossRankingOutput(
        strategy_name="value",
        description=f"B/P ratio = {params.book_value_metric} / current_price — top decile = LONG (más value)",
        items=final_items,
        n_tickers=len(with_data),
        n_skipped=n_skipped,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL #6: MULTIFACTOR
# ============================================
def multifactor(
    bars_by_ticker: dict,
    fundamentals_by_ticker: dict,
    prices_by_ticker: dict,
    params: MultifactorInput,
) -> CrossRankingOutput:
    """
    Paper #6 — Multifactor portfolio.

    Combina los rankings de momentum, low-vol y value en un score promedio:
      s_Ai = rank(f_Ai) / N           (rank normalizado a [0,1], 0=mejor)
      s_i  = (1/F) * sum_A(s_Ai)      (promedio cross-factor)

    Rankea ASC por s_i (menor score = mejor combined rank = top decile = LONG).

    Sub-strategies enabled/disabled vía params.include_*.
    """
    tickers = list(bars_by_ticker.keys())
    sub_outputs: dict = {}

    if params.include_momentum:
        sub_outputs["momentum"] = price_momentum(
            bars_by_ticker,
            PriceMomentumInput(
                tickers=tickers,
                formation_days=params.momentum_formation_days,
                skip_days=params.momentum_skip_days,
            ),
        )
    if params.include_low_volatility:
        sub_outputs["low_volatility"] = low_volatility(
            bars_by_ticker,
            LowVolatilityInput(
                tickers=tickers,
                lookback_days=params.lowvol_lookback_days,
            ),
        )
    if params.include_value:
        sub_outputs["value"] = value_strategy(
            fundamentals_by_ticker,
            prices_by_ticker,
            ValueInput(tickers=tickers),
        )

    if not sub_outputs:
        # Edge case: el user deshabilitó todos
        return CrossRankingOutput(
            strategy_name="multifactor",
            description="No factors enabled",
            items=[CrossRankingItem(
                ticker=t, factor_value=None, rank=None,
                decile=None, signal=SignalType.HOLD,
            ) for t in tickers],
            n_tickers=0,
            n_skipped=len(tickers),
            timestamp=datetime.now(),
        )

    # Combinar: para cada ticker, promedio de ranks normalizados a [0,1]
    # (0 = top, 1 = bottom).
    combined: dict = {}
    for ticker in tickers:
        normalized_ranks = []
        for sub_name, sub_out in sub_outputs.items():
            sub_item = next(
                (x for x in sub_out.items if x.ticker == ticker), None
            )
            if sub_item is None or sub_item.rank is None:
                continue
            n = sub_out.n_tickers
            if n <= 1:
                normalized_ranks.append(0.0)
            else:
                normalized_ranks.append((sub_item.rank - 1) / (n - 1))
        # Necesitamos al menos 1 sub-strategy con dato para incluir este ticker
        if normalized_ranks:
            combined[ticker] = sum(normalized_ranks) / len(normalized_ranks)

    items: List[CrossRankingItem] = []
    n_skipped = 0
    for ticker in tickers:
        score = combined.get(ticker)
        if score is None:
            n_skipped += 1
        items.append(CrossRankingItem(
            ticker=ticker,
            factor_value=score,
            rank=None, decile=None, signal=SignalType.HOLD,
        ))

    with_data = [it for it in items if it.factor_value is not None]
    without_data = [it for it in items if it.factor_value is None]
    with_data.sort(key=lambda it: it.factor_value)  # asc — menor score = mejor
    _assign_deciles_and_signals(with_data)

    enabled = ", ".join(sub_outputs.keys())
    return CrossRankingOutput(
        strategy_name="multifactor",
        description=f"Combined rank score across {len(sub_outputs)} factors: {enabled}",
        items=with_data + without_data,
        n_tickers=len(with_data),
        n_skipped=n_skipped,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL #8: PAIRS TRADING
# ============================================
def pairs_trading(
    bars_a: List[PriceBar],
    bars_b: List[PriceBar],
    params: PairsInput,
) -> PairsOutput:
    """
    Paper #8 — Pairs Trading.

    Idea: dos tickers históricamente correlacionados deberían moverse
    juntos. Cuando uno overperforma vs el promedio del par, está "rich"
    y se shortea; el otro está "cheap" y se compra. Dollar-neutral.

    Formulas:
        R_A = ln(P_A_t2 / P_A_t1)        log return de A sobre la ventana
        R_B = ln(P_B_t2 / P_B_t1)        log return de B
        R_mean = (R_A + R_B) / 2         media del par
        R_tilde_A = R_A - R_mean         demeaned return de A
        R_tilde_B = R_B - R_mean = -R_tilde_A

    Signal: R_tilde > 0 → ticker está "rich" → SHORT
            R_tilde < 0 → ticker está "cheap" → LONG

    La correlación (Pearson) del par sobre la ventana se devuelve como
    contexto — pares con correlation > 0.7 son los típicamente usables.
    """
    needed = params.lookback_days + 1
    if len(bars_a) < needed or len(bars_b) < needed:
        raise ValueError(
            f"Necesito al menos {needed} bars de ambos tickers"
        )

    closes_a = np.array([b.close for b in bars_a[-needed:]], dtype=float)
    closes_b = np.array([b.close for b in bars_b[-needed:]], dtype=float)

    # Log returns sobre la ventana completa: end / start
    R_A = float(np.log(closes_a[-1] / closes_a[0]))
    R_B = float(np.log(closes_b[-1] / closes_b[0]))
    R_mean = (R_A + R_B) / 2
    R_tilde_A = R_A - R_mean
    R_tilde_B = R_B - R_mean

    # Correlación de los daily returns (contexto, no la usamos para la signal)
    daily_a = np.diff(closes_a) / closes_a[:-1]
    daily_b = np.diff(closes_b) / closes_b[:-1]
    correlation = float(np.corrcoef(daily_a, daily_b)[0, 1]) if len(daily_a) > 1 else 0.0

    # Dollar positions: half del investment por lado, signo según demeaned
    half = params.total_investment / 2
    pos_a = -half if R_tilde_A > 0 else (half if R_tilde_A < 0 else 0.0)
    pos_b = -half if R_tilde_B > 0 else (half if R_tilde_B < 0 else 0.0)

    def _signal(rt: float) -> SignalType:
        if rt > 0.001:
            return SignalType.SHORT
        if rt < -0.001:
            return SignalType.LONG
        return SignalType.HOLD

    positions = [
        PairsPosition(
            ticker=params.ticker_a,
            log_return=R_A,
            demeaned_return=R_tilde_A,
            dollar_position=pos_a,
            signal=_signal(R_tilde_A),
        ),
        PairsPosition(
            ticker=params.ticker_b,
            log_return=R_B,
            demeaned_return=R_tilde_B,
            dollar_position=pos_b,
            signal=_signal(R_tilde_B),
        ),
    ]

    return PairsOutput(
        strategy_name="pairs_trading",
        ticker_a=params.ticker_a,
        ticker_b=params.ticker_b,
        correlation=correlation,
        lookback_days=params.lookback_days,
        mean_return=R_mean,
        positions=positions,
        total_investment=params.total_investment,
        timestamp=datetime.now(),
    )


# ============================================
# CROSS-SECTIONAL #9/#10: MEAN REVERSION (single + multiple clusters)
# ============================================
def mean_reversion(
    bars_by_ticker: dict,
    sectors_by_ticker: dict,         # {ticker: sector_name or None}
    params: MeanReversionInput,
) -> MeanReversionOutput:
    """
    Paper #9 (single cluster) / #10 (multiple clusters) — Mean Reversion.

    Para un cluster (set de tickers correlacionados, ej. mismo sector):
        R_i           = log return de i sobre la ventana
        R_mean        = (1/N) * sum(R_i)
        R_tilde_i     = R_i - R_mean             (demeaned)
        gamma         = I_cluster / sum(|R_tilde_i|)
        D_i           = -gamma * R_tilde_i        (posición en dólares)

    El signo negativo es la "reversion": shortemos los que subieron más
    que el cluster mean, longemos los que subieron menos. Cuando converjan
    al mean, hacemos profit.

    use_clusters=False → un cluster con todos los tickers (paper #9)
    use_clusters=True  → grupos por sector de tickers_meta.json (paper #10)

    La inversión se reparte equally entre los clusters non-empty.
    """
    # Construir clusters
    if params.use_clusters:
        clusters: dict = {}  # cluster_name → [ticker, ...]
        for ticker in bars_by_ticker.keys():
            sector = sectors_by_ticker.get(ticker) or "Sin clasificar"
            clusters.setdefault(sector, []).append(ticker)
    else:
        clusters = {None: list(bars_by_ticker.keys())}

    needed = params.lookback_days + 1
    positions: List[MeanReversionPosition] = []
    n_skipped = 0
    # Solo contamos los clusters con >=2 tickers usables para repartir investment
    usable_clusters = []
    cluster_returns: dict = {}  # cluster_name → {ticker: log_return}

    for cluster_name, cluster_tickers in clusters.items():
        returns: dict = {}
        for t in cluster_tickers:
            bars = bars_by_ticker.get(t, [])
            if len(bars) < needed:
                continue
            closes = np.array([b.close for b in bars[-needed:]], dtype=float)
            if closes[0] <= 0:
                continue
            returns[t] = float(np.log(closes[-1] / closes[0]))
        cluster_returns[cluster_name] = returns
        if len(returns) >= 2:
            usable_clusters.append(cluster_name)

    investment_per_cluster = (
        params.total_investment / len(usable_clusters) if usable_clusters else 0.0
    )

    for cluster_name, cluster_tickers in clusters.items():
        returns = cluster_returns[cluster_name]
        if len(returns) < 2:
            # cluster muy chico — todos HOLD
            for t in cluster_tickers:
                if t in returns:
                    positions.append(MeanReversionPosition(
                        ticker=t, cluster=cluster_name,
                        log_return=returns[t],
                        demeaned_return=0.0,
                        dollar_position=0.0,
                        signal=SignalType.HOLD,
                    ))
                else:
                    n_skipped += 1
                    positions.append(MeanReversionPosition(
                        ticker=t, cluster=cluster_name,
                        log_return=0.0,
                        demeaned_return=0.0,
                        dollar_position=0.0,
                        signal=SignalType.HOLD,
                    ))
            continue

        mean_R = sum(returns.values()) / len(returns)
        demeaned = {t: R - mean_R for t, R in returns.items()}
        abs_sum = sum(abs(d) for d in demeaned.values())
        gamma = investment_per_cluster / abs_sum if abs_sum > 0 else 0.0

        for t in cluster_tickers:
            if t not in returns:
                n_skipped += 1
                positions.append(MeanReversionPosition(
                    ticker=t, cluster=cluster_name,
                    log_return=0.0, demeaned_return=0.0,
                    dollar_position=0.0, signal=SignalType.HOLD,
                ))
                continue
            rt = demeaned[t]
            pos = -gamma * rt  # NEGATIVE: shortemos los outperformers
            if pos > 0.01:
                sig = SignalType.LONG
            elif pos < -0.01:
                sig = SignalType.SHORT
            else:
                sig = SignalType.HOLD
            positions.append(MeanReversionPosition(
                ticker=t, cluster=cluster_name,
                log_return=returns[t],
                demeaned_return=rt,
                dollar_position=pos,
                signal=sig,
            ))

    # Ordenar: por cluster, dentro de cada cluster por dollar_position desc
    positions.sort(key=lambda p: (p.cluster or "", -p.dollar_position))

    n_tickers = sum(1 for p in positions if p.dollar_position != 0.0)

    return MeanReversionOutput(
        strategy_name="mean_reversion",
        use_clusters=params.use_clusters,
        n_clusters=len(usable_clusters),
        n_tickers=n_tickers,
        n_skipped=n_skipped,
        lookback_days=params.lookback_days,
        total_investment=params.total_investment,
        positions=positions,
        timestamp=datetime.now(),
    )


# ============================================
# CONSENSUS SIGNAL (agregación)
# ============================================
def compute_consensus_signal(signals: List[SignalType]) -> SignalType:
    """
    Calcula la señal de consenso a partir de múltiples estrategias.
    Mayoría simple: LONG si >50% LONG, SHORT si >50% SHORT, HOLD si empate.
    """
    if not signals:
        return SignalType.HOLD

    long_votes = sum(1 for s in signals if s == SignalType.LONG)
    short_votes = sum(1 for s in signals if s == SignalType.SHORT)
    total = len(signals)

    if long_votes / total > 0.5:
        return SignalType.LONG
    elif short_votes / total > 0.5:
        return SignalType.SHORT
    else:
        return SignalType.HOLD
