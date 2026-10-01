# Architecture — v0.13.0

| Layer | Runtime | Responsibility |
|---|---|---|
| Public UI | Netlify + Vite | institutional dashboard, universe builder, charts, controls |
| Netlify API | Netlify Functions | Yahoo/EODHD connectors and authenticated PortfolioOPTIM proxy |
| Browser analytics | JavaScript | descriptive returns/risk, preview frontier, backtests, local diagnostics |
| PortfolioOPTIM | Render + Python | exact constrained optimization, common evaluator, walk-forward, robustness |
| Research | Yahoo + optional EODHD | market metadata, fundamentals, catalysts |
| Thesis state | Browser local storage | versioned thesis/invalidation notes |

## PortfolioOPTIM boundary
The browser never receives the PortfolioOPTIM secret. Netlify Functions read `PORTFOLIOOPTIM_API_URL` and `QUANT_SERVICE_SECRET` server-side and proxy authenticated requests.

### Exact endpoints
- `/optimize` — exact selected strategy, benchmarks, constrained frontier, risk decomposition and diagnostics.
- `/walkforward` — train-only optimization and untouched non-overlapping OOS test windows.
- `/robustness` — estimator grid, bootstrap weights and resampled frontier envelope.

## Governance principles
- Advanced controls are opt-in; blank fields preserve the v0.11.4.2 stable baseline.
- Current/benchmark weights are user inputs, never inferred.
- Equal Weight and Current Portfolio can be reference portfolios outside optimizer constraints and are labeled accordingly.
- Scenario presets are transparent diagnostics, not forecasts.
- Regime presets require explicit user action; no hidden allocation change occurs.
- Decision Desk summarizes evidence but does not recommend or execute trades automatically.
