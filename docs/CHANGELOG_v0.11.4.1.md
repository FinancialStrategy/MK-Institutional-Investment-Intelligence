# v0.11.4.1 — Strategy Comparison Audit Fix

- Re-scores sampled portfolios, Equal Weight, Current Portfolio, Risk Parity and Black-Litterman on the same PortfolioOPTIM base expected-return / Ledoit-Wolf covariance model used by the exact frontier.
- PortfolioOPTIM response now exposes the exact covariance matrix and model metadata for common-basis evaluation.
- Removes L2 regularization from the Black-Litterman comparison benchmark so the four core comparison strategies are not mixed with different regularization penalties. The selected BL strategy still honors the user-selected L2 setting.
- Corrects historical Sharpe and Sortino to use annualized daily excess-return statistics rather than CAGR divided by volatility.
- Labels VaR/CVaR explicitly as empirical 1-day 99% measures.
- Adds Initial Funding basis: Current Portfolio, Cash/New Funding, or Assume Already at Target. Initial transition turnover and costs are now treated consistently.
- Annual cost drag is calculated as gross CAGR minus net CAGR instead of simple summed basis-point charges.
- Equal Weight and Current Portfolio are explicitly marked as reference portfolios that may sit outside optimizer constraints.
- Backend service identity bumped to PortfolioOPTIM v0.11.4.1.
