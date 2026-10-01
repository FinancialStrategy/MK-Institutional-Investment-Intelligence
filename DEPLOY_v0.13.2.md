# v0.13.2 deployment

Repository: `FinancialStrategy / MK-Institutional-Investment-Intelligence`

This is a frontend-only patch. Render / PortfolioOPTIM backend stays on v0.13.0.

Replace:
- `src/institutional-advanced.js`
- `src/main.js`
- `src/styles.css`
- `package.json`
- `README.md`

Add:
- `docs/CHANGELOG_v0.13.2.md`
- `DEPLOY_v0.13.2.md`

Commit summary: `Add stressed volatility overlays v0.13.2`

After Netlify publishes, hard-refresh the app and run PortfolioOPTIM Exact before opening Stress.
