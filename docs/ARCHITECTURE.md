# Architecture — Netlify v0.9

| Layer | Runtime | Responsibility |
|---|---|---|
| Public Web App | Netlify + Vite | Institutional UI, universe builder, charts, controls |
| Netlify API | Netlify Functions | Yahoo market data, quote metadata, optimizer proxy, validation |
| Browser Analytics | JavaScript | Returns, risk, backtest, walk-forward, frontier preview |
| Quant Optimization | External Python service | PyPortfolioOpt exact constrained optimization |
| Market Data | Yahoo Finance initially | OHLCV and quote metadata |
| Research Sources | staged connectors | Fundamentals, filings, catalysts, official releases |
| Local Thesis Store | Browser localStorage v0.9 | Thesis/invalidation persistence until server store is introduced |

## Optimization boundary
The public product remains on `netlify.app`. The Python quant service is an analytical backend only and is reached through `/api/optimizer`; the browser never needs the backend service URL.
