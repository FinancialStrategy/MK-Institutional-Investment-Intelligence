# v0.13.0 Deployment

## A. Render backend — `FinancialStrategy/quant_service`
Replace/upload the contents of `quant_service/`:
- `app.py` (required)
- `README.md`
- `DEPLOY.md`
- `requirements.txt` (keep `packaging>=24.1`)
- `Dockerfile`
- `render.yaml`

Suggested commit summary:
`PortfolioOPTIM full institutional stack v0.13.0`

After Render is Live, verify:
`https://quant-service-ozki.onrender.com/health`
Expected version: `0.13.0`.

## B. Netlify frontend — `FinancialStrategy/MK-Institutional-Investment-Intelligence`
Replace/upload:
- `src/main.js`
- `src/styles.css`
- `src/institutional-advanced.js` (new)
- `netlify/functions/portfolio-advanced.js` (new)
- `package.json`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/MODULE_MATRIX.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG_v0.13.0.md` (new)

No change is required to `index.html` or `netlify.toml` for the v0.13 features, but the full package includes the validated baseline copies.

Suggested commit summary:
`Full institutional portfolio stack v0.13.0`

Required Netlify environment variables remain:
- `PORTFOLIOOPTIM_API_URL`
- `QUANT_SERVICE_SECRET`
- optional `EODHD_API_TOKEN`

## C. Smoke test
1. Hard refresh the Netlify site.
2. Optimization → Run Real-Data Frontier → Run PortfolioOPTIM Exact.
3. Verify PortfolioOPTIM version `0.13.0` in the exact output/Decision Desk.
4. Open Robustness and run the model/bootstrap test.
5. Open Walk-Forward and run Portfolio OOS.
6. Open Migration and supply Current Weights before building the trade list.
7. Check Risk, Stress, Market Regime and Decision Desk for the new institutional panels.
