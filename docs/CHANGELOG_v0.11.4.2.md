# v0.11.4.2 — Common Basis Consistency Fix

- Uses raw PortfolioOPTIM solver weights as the canonical portfolio definition; presentation rounding no longer changes portfolio metrics.
- Maximum Sharpe/Tangency, Minimum Volatility, Risk Parity and Black–Litterman now expose `common_performance` from one backend evaluator using the same base expected-return vector, covariance matrix and risk-free rate.
- Portfolio Solutions, Efficient Frontier markers and Strategy Comparison Lab consume that same canonical performance source.
- Adds a frontend model-consistency audit badge and reports a warning if backend/common-model metrics diverge materially.
- Black–Litterman no longer disappears silently: missing views or view tickers outside the selected universe are shown explicitly as unavailable diagnostics.
- Black–Litterman optimization is still performed on posterior returns/covariance, while comparison metrics are re-scored on the shared base model.
- Constraint diagnostics now attach to each optimizer benchmark; selected regularized Max Sharpe diagnostics are clearly separated from pure Tangency benchmark bindings.
- Binding lower/upper detection uses raw weights and tighter numerical tolerances, so all assets at configured floors/caps are reported.
- Default Black–Litterman placeholder now uses `GC=F` instead of `GLD` for the default selected universe.
- PortfolioOPTIM service version: 0.11.4.2.
