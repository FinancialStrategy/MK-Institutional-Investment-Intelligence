# v0.11.4 — Portfolio Strategy Comparison Lab

- Adds common-basis comparison for Maximum Sharpe / Tangency, Minimum Volatility, Risk Parity, Black–Litterman, Equal Weight and Current Portfolio when available.
- Adds historical common-sample path diagnostics with selectable monthly, quarterly or no-rebalance implementation.
- Adds transaction-cost assumption in basis points, applied consistently at rebalance events.
- Adds CAGR, annualized volatility, Sharpe, Sortino, maximum drawdown, Calmar, 99% VaR, 99% CVaR, worst month, positive-day ratio, annualized turnover and annualized cost drag.
- Adds net-of-assumed-cost strategy NAV and drawdown path charts.
- Retains capital-weight and risk-contribution heatmaps.
- Governance note explicitly distinguishes in-sample implementation diagnostics from out-of-sample performance claims.
- PortfolioOPTIM backend is unchanged from the deployed v0.11.2 service identity.
