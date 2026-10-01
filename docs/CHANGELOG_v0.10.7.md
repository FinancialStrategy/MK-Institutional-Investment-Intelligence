# v0.10.7 — Institutional Frontier Presentation + Secure Optimizer Proxy

- Added authenticated Netlify → Render optimizer proxy using `QUANT_SERVICE_SECRET`.
- Added structured handling for non-JSON upstream responses; HTML error pages no longer surface as raw `Unexpected token <` parsing failures.
- Reworked Efficient Frontier presentation: exact PortfolioOPTIM frontier is the primary curve when available.
- CML no longer forces the y-axis down to the risk-free intercept; it is clipped to the visible investment-region scale.
- Reduced feasible-set point density and opacity.
- Added cleaner labels for Tangency, Minimum Volatility, Current Portfolio, Equal Weight, Risk Parity and Black–Litterman markers.
- Added `EXACT LIVE` / `PREVIEW` status badge and a more compact Portfolio Solutions panel.
- Preserved Classic v0.9 and MK LabGEN dual presentation layers.
