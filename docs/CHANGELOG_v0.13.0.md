# v0.13.0 — Full Institutional Portfolio Stack

v0.13.0 preserves the v0.11.4.2 stable PortfolioOPTIM baseline and adds opt-in institutional decision layers around it. Existing exact-frontier, common-basis, CML/tangency, portfolio-solution and strategy-comparison behavior is unchanged unless a new control is explicitly enabled.

## 1. Walk-Forward / Out-of-Sample Strategy Lab
- Rolling train/test folds for Maximum Sharpe, Minimum Volatility, Risk Parity, Black–Litterman and Equal Weight.
- Non-overlapping test windows, transaction costs, fold weights and annualized turnover.
- OOS CAGR, volatility, Sharpe, Sortino, maximum drawdown, Calmar, empirical 1-day VaR/CVaR and terminal NAV.

## 2. Robust Optimization & Stability
- Return-model grid: historical mean, EMA expected return, CAPM proxy.
- Risk-model grid: Ledoit–Wolf, sample covariance, EWMA covariance.
- Bootstrap-resampled observed-return histories; no synthetic market observations.
- Weight stability bands, L1 stability score and resampled efficient-frontier envelope.

## 3. Institutional Constraint Engine
- Weight bounds plus factor, asset-class/group and region constraints.
- Commodity/equity/bond allocation controls.
- Minimum effective-N diversification control.
- Current-weight turnover limit and turnover penalty.
- Benchmark tracking-error limit.
- Liquidity-derived per-asset capacity caps from trailing ADTV, participation rate and maximum exit days.
- Constraint precheck and detailed binding diagnostics.

## 4. Current → Target Migration
- Current weights to selected PortfolioOPTIM target.
- BUY/SELL/HOLD trade list, delta weights, estimated notionals, turnover and transaction-cost estimate.
- Current vs target common-model return, volatility and Sharpe.

## 5. Risk Decomposition Desk
- Marginal risk contribution, total risk contribution and risk-contribution percentages.
- HHI, Effective N and diversification ratio.
- Correlation clustering diagnostics.

## 6. Scenario & Stress Optimization
- Strategy-level transparent stress matrix for equity shock, inflation shock, rates proxy, growth recession and correlation-spike risk overlay.
- Scenarios are deterministic diagnostics, not forecasts.

## 7. Regime-Aware Allocation
- Risk-On / Neutral / Risk-Off diagnostic derived from the existing market-regime engine.
- Explicit user action applies a named constraint preset; no hidden automatic portfolio switching.

## 8. Black–Litterman View Studio
- Absolute and relative views.
- Per-view confidence inputs.
- Tau control and posterior-return diagnostics.
- Common-basis comparison remains separate from posterior optimization scoring.

## 9. Efficient Frontier Diagnostics
- Exact constrained frontier remains primary.
- CML remains anchored to unregularized Maximum Sharpe / Tangency.
- Frontier curvature and strategy distance-to-frontier diagnostics.
- Resampled frontier uncertainty envelope in Robustness Lab.

## 10. Executive Portfolio Decision Desk
- Target strategy snapshot, expected return, volatility, Sharpe, migration turnover/cost, robustness stability, OOS Sharpe, worst transparent scenario and largest proposed trades.
- Decision support only; no automatic recommendation or trade execution.

## Governance
- Yahoo-derived market history remains real-data only; no forward/back fill and no synthetic market observations.
- PortfolioOPTIM is the only user-facing optimizer name.
- v0.11.4.2 remains the stable reference behavior when all advanced controls are left blank/off.
