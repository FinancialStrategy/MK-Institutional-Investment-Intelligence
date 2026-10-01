# v0.13.2 — Stress Volatility Overlay

- Defines stressed volatility for all institutional stress scenarios rather than only Correlation Spike.
- Adds scenario-specific volatility multipliers and correlation-convergence assumptions.
- Computes `Sigma_stress` and `sqrt(w' Sigma_stress w)` for every strategy/scenario.
- Adds asset-level Vol Mult. attribution.
- Labels stressed volatility as a proxy risk overlay, not a forecast.
- Preserves deterministic weighted stress P&L from v0.13.1.
