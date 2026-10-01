# v0.11.3 — Optimization Analytics Polish

- Keeps the PortfolioOPTIM Exact Frontier visually primary and further subdues preview diagnostics.
- Replaces the paginated frontier legend with a compact non-paginated legend.
- Hides the Feasible Set from the legend by default while retaining it as an optional diagnostic layer.
- Adds Tangency Return, Tangency Volatility, Tangency Sharpe, CML Slope and Minimum Volatility analytics above the chart.
- Adds Return / Volatility / Sharpe summary metrics to each Portfolio Solution before asset weights.
- Marks Maximum Sharpe / Tangency explicitly as the CML anchor.
- Tangency tooltip now includes the configured risk-free rate and identifies the unregularized solution.
- Removes the internal scroll constraint from Portfolio Solutions on wide screens.
- Suppresses duplicate Selected portfolio output when the selected method is already one of the benchmark solutions.
- L2-Regularized Max Sharpe remains visible only when L2 Gamma > 0; pure Tangency remains the CML anchor.
