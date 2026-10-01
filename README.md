# MK Institutional Investment Intelligence — v0.13.0

Netlify institutional portfolio analytics frontend + secure Render PortfolioOPTIM backend.

v0.13.0 preserves the validated v0.11.4.2 exact-frontier/common-basis baseline and adds a complete opt-in institutional portfolio-construction stack:

- Portfolio-level Walk-Forward / Out-of-Sample Strategy Lab
- Robust Optimization & Parameter Stability
- Resampled Efficient Frontier diagnostics
- Institutional Constraint Engine
- Current Portfolio → Target Portfolio Migration
- Risk Decomposition Desk
- Strategy Scenario & Stress matrix
- Regime-Aware Allocation presets
- Black–Litterman View Studio
- Efficient Frontier Diagnostics
- Executive Portfolio Decision Desk

All advanced constraint fields default to OFF/blank, so leaving them untouched preserves the stable baseline behavior.

## Architecture
- **Frontend:** Netlify + Vite/JavaScript/ECharts
- **Exact engine:** PortfolioOPTIM on Render
- **Market data:** validated real market history; no synthetic market observations
- **Research:** Yahoo market metadata + optional EODHD deep fundamentals/catalysts
- **Security:** backend URL/secret remain server-side behind Netlify Functions

## Netlify environment variables
- `EODHD_API_TOKEN` — optional deep fundamentals and catalyst data.
- `PORTFOLIOOPTIM_API_URL` — PortfolioOPTIM Render service URL.
- `QUANT_SERVICE_SECRET` — shared private service secret.

## Build

```bash
npm install
npm run build
```

See `docs/CHANGELOG_v0.13.0.md` and `quant_service/DEPLOY.md`.
