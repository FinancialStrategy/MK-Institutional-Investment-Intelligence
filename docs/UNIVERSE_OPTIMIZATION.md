# Investment Universe & Optimization Architecture — v0.9

## Universe pipeline
1. Region / country
2. Asset class
3. Group / sector / commodity family
4. Factor or theme taxonomy
5. Liquidity and data-quality gates
6. User-selected subset
7. Portfolio construction / optimization

The factor taxonomy is not itself a measured factor exposure. A later factor-regression layer will estimate loadings against Fama-French and cross-asset factors.

## Supported universe families
- Global equities and broad market ETFs
- Fama-French-style factor proxy ETFs
- Government and corporate bond ETFs
- Precious metals: gold, silver, platinum
- Mining equities / ETFs: gold, copper, diversified miners
- Industrial metals, energy, agriculture futures
- FX / USD proxy
- Türkiye / emerging-market assets

## Optimization
### Browser preview
Real Yahoo price data -> common-date log returns -> annualized expected returns / covariance -> candidate long-only portfolios -> approximate efficient envelope.

### Exact PortfolioOPTIM service
The public site remains on Netlify. Netlify proxies to an optional Python quant service through `PORTFOLIOOPTIM_API_URL`.

Supported methods:
- Max Sharpe
- Minimum volatility
- Quadratic utility
- Efficient return / efficient risk
- Hierarchical Risk Parity
- Critical Line Algorithm
- Minimum semivariance
- Minimum CVaR
- Minimum CDaR

Expected-return and covariance assumptions must be visible in the Methodology/Audit layer. No optimizer output should be presented without the data window and constraints.
