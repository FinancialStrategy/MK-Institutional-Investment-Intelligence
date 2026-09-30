# v0.10.5

- Exact PyPortfolioOpt frontier now scans only the feasible upper branch.
- Dynamic chart scaling retained; frontier chart enlarged to 520px.
- Added Capital Market Line, Equal Weight, Current Portfolio, and Exact Optimizer markers.
- Feasible-set scatter is visually thinned only at render time; analytics still use the full sample.
- Quant service can be protected with `QUANT_SERVICE_SECRET`.
- Netlify optimizer proxy adds server-side bearer authentication.
- PyPortfolioOpt pinned to 1.6.0.
- Added Dockerfile and Render/Railway deployment instructions.
