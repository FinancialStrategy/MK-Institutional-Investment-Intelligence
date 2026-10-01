# v0.10.6 — Institutional Frontier Upgrade

- Exact PyPortfolioOpt frontier is the primary curve when the quant service returns it.
- Added exact benchmark portfolios: minimum volatility, maximum Sharpe/tangency, risk parity, and Black-Litterman when views exist.
- Added Current Portfolio, Equal Weight, Risk Parity, Black-Litterman, Tangency and risk-free markers to the frontier chart.
- Capital Market Line is anchored to the exact tangency portfolio.
- Added constraint diagnostics for binding lower/upper weight bounds and factor bounds.
- Renamed the right-side panel to Optimal Portfolios when exact results exist.
- Suppressed de minimis weights below 0.10% in display tables.
- Improved chart density, labeling, axis padding and tooltip hierarchy.
