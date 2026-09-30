# v0.10.3 Research Connector Diagnostics

- Switched EODHD fundamentals to recommended `/api/v1.1/fundamentals/{ticker}` endpoint.
- Added robust EODHD JSON/error validation.
- Added `/api/research-health` diagnostics endpoint; reports only token presence/length, never the token.
- EODHD now has precedence for fundamental valuation fields; Yahoo remains primary for market price/market metadata.
- Both UI shells consume one merged research state.
- Added visible `RUN CONNECTOR DIAGNOSTICS` control to Research.
