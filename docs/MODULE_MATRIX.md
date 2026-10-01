# Module Matrix — v0.13.0

| Module | Status | Inputs | Outputs |
|---|---|---|---|
| Executive | Live | single asset | regime/risk cockpit |
| Universe Builder | Live | region/asset/group/factor filters | selected investable set |
| Factor Lab | Live | returns + FF factors | factor loadings, alpha, R² |
| Portfolio | Live | tickers/weights/benchmark | NAV, beta, TE, RC |
| PortfolioOPTIM Exact | Live | aligned prices + constraints | exact weights/frontier/benchmarks |
| Strategy Comparison | Live | exact solutions + common evaluator | return/vol/Sharpe, HHI, Effective N, turnover |
| Robustness | v0.13 | exact request | model grid, bootstrap weights, stability, resampled frontier |
| Migration | v0.13 | current weights + target | trade list, turnover, cost, current/target metrics |
| Decision Desk | v0.13 | optimizer + optional robustness/OOS/migration | executive implementation summary |
| Market Regime | Live + v0.13 | OHLCV | structural/tactical states + allocation preset |
| Volatility | Live | returns | RV/EWMA/ratio |
| Risk | Live + v0.13 | portfolio/exact strategy | VaR plus marginal/total RC and clustering |
| Stress | Live + v0.13 | portfolio + strategies | stress P&L and transparent strategy scenario matrix |
| Liquidity | Live | position value + volume | ADTV/exit days |
| Backtest | Live | strategy parameters | historical diagnostics |
| Walk-Forward | Live + v0.13 | rolling train/test windows | single-asset and portfolio OOS results |
| Black–Litterman View Studio | v0.13 | absolute/relative views + confidence + tau | posterior weights/returns |
| Institutional Constraints | v0.13 | factors/groups/current/benchmark/liquidity | constrained exact solutions + diagnostics |
| Research | Live | ticker | Yahoo/EODHD merged research |
| Thesis Monitor | Live | thesis/invalidation | versioned local thesis |
