# v0.11.0 — Strategy Comparison Lab

- Adds common-basis comparison for Maximum Sharpe / Tangency, Minimum Volatility, Risk Parity, Black–Litterman, Equal Weight and Current Portfolio.
- Recomputes comparison return, volatility and Sharpe from the same historical expected-return vector, covariance matrix and risk-free rate.
- Adds HHI, Effective N, maximum weight and turnover-versus-current diagnostics.
- Adds capital-weight and risk-contribution heatmaps.
- Keeps Black–Litterman posterior assumptions for optimization while re-scoring its weights on the common comparison basis.
- Adds a methodology warning that in-sample comparison is not evidence of out-of-sample superiority.
- Improves Tangency vs regularized Max-Sharpe label separation.
