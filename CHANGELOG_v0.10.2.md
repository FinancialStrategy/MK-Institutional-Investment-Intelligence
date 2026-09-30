# v0.10.2 Research Connector Hotfix

## Root causes fixed
1. Yahoo v7 quote and v10 quoteSummary are crumb/cookie gated in 2026. v0.10.1 called them without an authenticated crumb, so they commonly returned HTTP 401 / Invalid Crumb.
2. Deep fundamentals and sourced earnings catalysts depended on EODHD_API_TOKEN. A subscription alone is not enough; the token must be configured in Netlify environment variables.
3. The frontend only applied the EODHD valuation fallback when a Yahoo `metrics` object already existed. If Yahoo research failed completely, the fallback could not reconstruct the valuation panel.
4. Yahoo chart fallback collected closing prices but did not use the latest valid close when `meta.regularMarketPrice` was absent.

## Changes
- Added server-side Yahoo cookie + crumb handshake helper.
- Authenticated Yahoo quote / quoteSummary calls now append the crumb and cookie.
- Chart remains the no-auth hard fallback and now supplies the latest valid close.
- Fundamentals: EODHD primary when configured; authenticated Yahoo annual statements fallback if EODHD is unavailable.
- Catalysts: EODHD calendar primary when configured; Yahoo calendarEvents fallback.
- Frontend valuation reconstruction now works even when Yahoo research fails completely but another fundamental source succeeds.
- Added per-module source diagnostics instead of silently displaying N/A.

## Netlify configuration
Set `EODHD_API_TOKEN` in Site configuration -> Environment variables to enable the preferred deep fundamental and catalyst source.
