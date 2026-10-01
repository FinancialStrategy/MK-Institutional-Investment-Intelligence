# v0.10.9 — Strategy Selector & True Tangency

- Separates the pure constrained Maximum-Sharpe/Tangency benchmark from L2-regularized Max-Sharpe.
- CML is anchored to the pure constrained tangency portfolio.
- Adds Target Return / Minimum Risk and Target Volatility / Maximum Return controls.
- Adds risk-aversion control for Maximum Quadratic Utility.
- Expands Optimization Strategy selector and contextual methodology help.
- Sends target_return, target_volatility and risk_aversion to the quant service.
- Quant service health version 0.10.7.
