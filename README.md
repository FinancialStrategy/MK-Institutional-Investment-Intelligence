## v0.11.1 — Strategy Comparison Lab

Adds apples-to-apples Maximum Sharpe, Minimum Volatility, Risk Parity, Black–Litterman, Equal Weight and Current Portfolio diagnostics on a common risk/return basis, plus capital-weight and risk-contribution heatmaps.

# MK Institutional Investment Intelligence — v0.11.4.2

Netlify frontend + secure optional Python PortfolioOPTIM backend. v0.11.4.2 hardens the Portfolio Strategy Comparison Lab with a single canonical backend evaluator, raw solver weights, benchmark-specific constraint diagnostics, and explicit Black-Litterman availability diagnostics. Historical path diagnostics, transaction-cost-aware NAV/drawdown comparisons, VaR/CVaR, turnover, concentration and risk-contribution analytics remain available.

See `quant_service/DEPLOY.md`.

# MK Institutional Investment Intelligence — Netlify v0.9

Netlify-first institutional research, factor analytics, portfolio risk and optimization dashboard.

## v0.9 — Factor & Research Engine
- Fixed Research / Load Valuation Snapshot failure with a multi-endpoint Yahoo connector and chart-metadata hard fallback.
- Fama–French 5 Factor + Momentum daily regression using Kenneth R. French factor files and validated Yahoo asset returns.
- Factor exposure heatmap, alpha/R² diagnostics and equal-weight universe factor exposure.
- Factor-neutral / factor-bounded PortfolioOPTIM constraints.
- Deep fundamentals connector via EODHD (revenue, margins, FCF, ROE, ROIC, net debt).
- Valuation snapshot with partial-data status instead of module failure.
- Sourced earnings catalyst connector via EODHD when configured.
- Versioned Thesis Monitor and Thesis Change Log in browser storage.
- Existing Universe Builder, Efficient Frontier, risk, stress, liquidity, backtest and walk-forward modules remain intact.

## Netlify environment variables
- `EODHD_API_TOKEN` — enables deep company fundamentals and sourced earnings catalysts.
- `PORTFOLIOOPTIM_API_URL` — URL of the optional Python quant service for exact PortfolioOPTIM optimization.

The Yahoo valuation layer does not require an API key. If Yahoo quote/quoteSummary metadata is unavailable, the connector falls back to Yahoo chart metadata and returns unavailable fields as `N/A` rather than crashing the Research screen.

## Data governance
No synthetic market observations. Missing data remain missing. Factor regressions require at least 126 common daily observations. Company fundamentals are kept separate from market-derived evidence. Factor labels in the Universe Builder are taxonomy tags; measured exposures come only from regression.

## Build
```bash
npm install
npm run build
```

The public product remains Netlify-first. Exact PortfolioOPTIM calculations are proxied by Netlify to the optional Python quant service; browser clients never need the service URL.


## v0.10.3 Dual UI + Portfolio Construction

- **Classic v0.9 UI** remains available as the original analyst-oriented interface.
- **MK LabGEN Executive UI** is a separate presentation layer using thin Arial/Arial Narrow sans-serif typography, orange/white institutional branding and a small Turkish flag beside the MK mark.
- Both interface modes support **Dark** and **Light** themes independently. UI mode and theme persist in browser localStorage.
- All analytics and research modules share the same state/calculation layer; changing UI mode never changes portfolio, factor, fundamental, thesis or risk results.
- PortfolioOPTIM service now exposes **Black-Litterman** and **Risk Parity / Equal Risk Contribution** in addition to existing optimization methods.
- Black-Litterman accepts optional annual absolute return views (`SPY:0.08,GLD:0.06`) and explicitly reports that the current prior is historical mean returns.
- Risk Parity accepts optional custom risk budgets and defaults to equal risk budgets. Existing factor exposure bounds remain available.


## v0.10.3 dual-layout hotfix

This build corrects the v0.10 presentation implementation. The previous build applied a second CSS skin to essentially the same page composition. v0.10.3 provides two genuinely separate presentation shells while preserving one analytics/data state:

- **Classic v0.9** — preserves the existing v0.9 top-navigation analytical layout.
- **MK LabGEN Executive** — separate left-navigation executive workspace, thin Arial Narrow/Arial institutional typography, orange/white project branding, small Turkish flag, distinct executive cockpit composition.
- **Always-visible interface dock** — fixed control with `CLASSIC v0.9 / MK LABGEN` and `LIGHT / DARK`, stored in localStorage.
- All quantitative modules share the same state, data and calculations; only the presentation shell changes.


## v0.10.3 Research connector note
Yahoo metadata endpoints are authenticated server-side with a cookie/crumb handshake. EODHD remains the preferred deep-fundamentals/catalyst source when `EODHD_API_TOKEN` is configured. Research panels expose connector diagnostics rather than silently collapsing to N/A.


## v0.10.3 Research source policy
- Yahoo Finance: market price/chart metadata and market-derived fields.
- EODHD: primary deep fundamentals, valuation fields and catalysts.
- Both Classic v0.9 and MK LabGEN render the same merged research state.
- `/api/research-health?ticker=AAPL` reveals connector status and whether the server-side token is visible, but never returns the token.


## v0.11.2 Frontier Presentation Upgrade
- Exact PortfolioOPTIM frontier promoted to the primary chart when available.
- Exact Min Vol, Tangency/Max Sharpe, Risk Parity, Black-Litterman, Equal Weight and Current Portfolio markers.
- Capital Market Line uses the exact Max Sharpe portfolio and shows the risk-free intercept.
- Constraint diagnostics expose binding asset/factor constraints.
- Portfolio tables suppress de minimis weights below 0.10% by default.
