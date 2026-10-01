# v0.9 Factor & Research Engine — Change Log

## Research reliability fix
- Replaced the brittle single Yahoo `/v7/finance/quote` dependency with a multi-endpoint Yahoo research connector.
- Added `quoteSummary` attempts and a Yahoo chart hard fallback.
- Research no longer fails just because valuation metadata is partially unavailable; missing fields are `N/A`.
- EODHD valuation metrics can fill missing Yahoo valuation fields when `EODHD_API_TOKEN` is configured.

## Factor Engine
- Added Kenneth R. French daily U.S. 5-factor + Momentum connector.
- Added OLS regression with alpha, six factor loadings, t-statistics and R-squared.
- Added factor exposure heatmap and equal-weight universe exposure view.
- Minimum 126 common daily observations; no synthetic filling.

## Optimization
- Added factor exposure constraints to PortfolioOPTIM request schema.
- Supports bounded exposure for MKT, SMB, HML, RMW, CMA and MOM in EfficientFrontier, Semivariance, CVaR and CDaR paths.
- HRP and CLA explicitly reject unsupported factor constraints.
- Exact constrained frontier can overlay the browser preview frontier.

## Fundamentals / Catalysts
- Added EODHD company fundamentals connector.
- Annual/quarterly evidence includes revenue, operating margin, net income, FCF, ROE, ROIC and net debt when source fields exist.
- Added EODHD sourced earnings catalyst connector.
- Source-not-configured states remain visible and do not fabricate values.

## Thesis Monitor
- Added per-ticker versioned thesis history.
- Saves thesis text, timestamp, research status and a compact research snapshot.
- Added change log vs previous version.
