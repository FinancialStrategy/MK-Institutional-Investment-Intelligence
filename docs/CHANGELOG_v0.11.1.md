# v0.11.1 — Exact Tangency Geometry Fix

- Disabled spline smoothing on the exact PyPortfolioOpt frontier; smoothing could visually overshoot a convex frontier and make the CML appear to cross it twice.
- Increased exact frontier resolution from 45 to 121 feasible target-return solves.
- Injected the exact constrained Maximum-Sharpe/Tangency solution into the frontier point set.
- Tangency performance now comes directly from the optimizer before clean-weight rounding, preventing display-weight rounding from moving the marker off the frontier.
- Quant service health version advanced to 0.10.8.
