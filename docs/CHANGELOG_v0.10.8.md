# v0.10.8 — Exact Optimizer Activation Hotfix

- Re-styled RUN PYPORTFOLIOOPT as an active primary control instead of a visually-muted secondary button.
- Added `/api/quant-health` server-side health proxy.
- Optimization UI now shows PyPortfolioOpt online/offline state and backend version.
- Added explicit running state and better error handling for exact optimizer requests.
- Exact optimizer button remains clickable when health status is unknown so users can surface the actual upstream error.
