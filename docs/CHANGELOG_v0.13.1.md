# v0.13.1 — Institutional Stress Engine Fix

- Replaces scenario-level constant returns with audited asset-level shock vectors aggregated as `sum(weight × shock)`.
- Adds robust handling for strategy weights supplied as arrays or ticker-keyed objects.
- Adds scenario attribution table: ticker, asset class, group, weight, shock, contribution, and mapping status.
- Adds mapping diagnostics; unknown assets are explicitly flagged instead of silently treated as fully mapped.
- Refines scenario definitions for broad equity, mining, inflation, rate and recession shocks.
- Adds correlation-spike risk overlay using a stressed covariance matrix; deterministic return remains 0 while stressed portfolio volatility is recomputed per strategy.
- Adds base-volatility, stressed-volatility and delta-volatility diagnostics for risk-overlay scenarios.
- Updates visible frontend version to v0.13.1.
- PortfolioOPTIM backend remains v0.13.0 and does not require a Render deployment for this release.
