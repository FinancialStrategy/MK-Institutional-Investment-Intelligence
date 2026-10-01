# MK Institutional Investment Intelligence — v0.13.2

Frontend-only Stress Risk Overlay update. PortfolioOPTIM Render backend remains v0.13.0.

## What changed

- Deterministic stress scenarios still compute portfolio P&L as `sum(weight × asset shock)`.
- Every stress scenario now also carries an explicit covariance-risk overlay so **Stressed Vol** and **Delta Vol** are defined for Equity Shock, Inflation Shock, Rates +100bp, Growth Recession and Correlation Spike.
- Stressed volatility is calculated as `sqrt(w' Sigma_stress w)`.
- `Sigma_stress` applies scenario-specific asset-volatility multipliers and a transparent correlation-convergence assumption to the common PortfolioOPTIM covariance matrix.
- Scenario Attribution displays each asset's volatility multiplier and the risk-overlay assumption.
- The UI labels stressed volatility as a **proxy**, not a forecast.
- Asset-level stress P&L attribution and mapping diagnostics from v0.13.1 are preserved.

## Deployment

Upload this patch only to `FinancialStrategy / MK-Institutional-Investment-Intelligence`. Do **not** upload it to `quant_service`.

Required files:
- `src/institutional-advanced.js`
- `src/main.js`
- `src/styles.css`
- `package.json`
- `README.md`
- `docs/CHANGELOG_v0.13.2.md`
- `DEPLOY_v0.13.2.md`
