# INTEREST LOAN COST SIMULATOR INTELLIGENCE

MK FinTECH LabGEN @2026 Istanbul Atelier

Institutional bilingual (EN/TR) borrower, investment, lender, tax, spread, scenario and loan-curve analytics for deployment on Netlify with a Python/FastAPI calculation engine.

## Design system

- Institutional hedge-fund style.
- Thin typography only; no heavy/bold UI typography.
- Dark navy default theme plus Executive Light theme.
- White and orange primary typography.
- Permanent MK monogram and polished silver crescent-star brand symbol; the star is aligned on the outward centre ray of the crescent.
- Left-column navigation with 15 analytical sections.
- Wide KPI ribbon and horizontal loan-cost term-structure chart.

## Architecture

- `site/`: no-build Netlify frontend (HTML/CSS/JavaScript + Plotly.js).
- `backend/`: Python FastAPI calculation and Excel export engine.
- `netlify.toml`: deploys `site/` directly; no npm build step.
- `render.yaml`: deploys the Python API on Render.
- `.github/workflows/ci.yml`: Python tests + JavaScript syntax check.

The web UI and the value-only Excel export use the same Python calculation engine.

## Analytical modules

1. Executive Dashboard
2. Input Center
3. Tax & Regulatory Registry
4. Borrower Cost
5. Investment / TLREF Return
6. Net Carry & Break-Even
7. Lender Economics
8. Loan Yield Curve
9. Maturity Ladder / VKGS
10. Scenario Lab
11. Sensitivity Lab
12. Inflation / Real Cost
13. Methodology
14. Sources
15. Export Center

## Curve engine

The loan cost curve is deliberately separated from the historical TLREF time series. TLREF is the overnight reference-rate anchor, not a multi-tenor credit curve. The application therefore does **not** infer 1W-10Y loan rates from TLREF alone and does not invent market spreads.

For each tenor `T`, the raw annual loan quote is constructed as:

`q(T) = TLREF + s_base + s_tenor(T) + l(T) + k(T) + f(T)`

where:

- `s_base` = user-entered base credit spread,
- `s_tenor(T)` = tenor-specific credit-spread adjustment,
- `l(T)` = liquidity premium,
- `k(T)` = capital charge,
- `f(T)` = annualised fee equivalent.

All overlays are explicit user or approved internal-pricing inputs. Default tenor set: ON, 1W, 1M, 3M, 6M, 9M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y. Tenor spread/liquidity/capital/fee adjustments default to zero.

### Nelson-Siegel

The quoted tenor nodes are structurally smoothed with:

`y_NS(T) = beta0 + beta1 * [(1-exp(-T/tau1))/(T/tau1)] + beta2 * [(1-exp(-T/tau1))/(T/tau1) - exp(-T/tau1)]`

`beta0` controls the long-run level, `beta1` primarily controls slope, `beta2` controls the first curvature/hump, and `tau1` determines where that curvature is concentrated across maturity.

### Svensson

Svensson adds a second curvature factor:

`y_SV(T) = y_NS(T) + beta3 * [(1-exp(-T/tau2))/(T/tau2) - exp(-T/tau2)]`

`beta3` and `tau2` allow a second turning region when the observed tenor structure requires more flexibility.

### Calibration

NS/Svensson parameters are calibrated by bounded nonlinear least squares against the raw `q(T)` nodes. The objective is to minimise squared quote residuals; RMSE is retained as a fit-quality diagnostic. NS is fitted with at least four tenor nodes; Svensson is fitted when at least six nodes are available.

### Critical separation from borrower cash cost

NS/Svensson are fitted to `q(T)`, **not** to maturity-dependent borrower cash-cost annualisation. After the quote curve is constructed, the engine separately applies BSMV, KKDF, facility fees/commission, tax shield and inflation to calculate cash-effective, after-tax and real borrowing costs at each tenor. This prevents a flat TLREF + flat spread assumption from producing a mechanically downward-sloping quote curve simply because short-period cash costs were annualised.

Sanity rule: when TLREF and every spread/premium/fee overlay are flat across tenor, the raw quote curve must also be flat. A fitted curve that materially departs from its raw nodes should be treated as a fit-quality warning, not as a market forecast.

Historical Borsa Istanbul TLREF observations are a separate time-series analysis and must not be interpreted as the cross-sectional 1W-10Y loan curve. Official source: https://www.borsaistanbul.com/endeksler/tlref

## Tax registry embedded in this build

Verified as of 2026-10-04. All rates remain user-overridable because product classification and exemptions can change the applicable treatment.

- TRY deposit withholding: 17.5% up to 6 months, 15% over 6 months and up to 1 year, 10% over 1 year.
- General corporate income tax: 25%.
- Banks and specified financial institutions corporate tax: 30%.
- BSMV: 5% for other bank/insurance transactions; 15% for consumer loans.
- KKDF: 15% for consumer loans; 0% for other loans unless another rule applies.

Official references:

- https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=DUYURU%2FUNIVERSAL%2F2026%2F2026_Gecici67.pdf
- https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=DUYURU%2FUNIVERSAL%2F2026%2F2026_Kurumlar_Vergisi_Beyan_Rehberi.pdf
- https://gib.gov.tr/mevzuat/kanun/445/bkk/1849
- https://gib.gov.tr/mevzuat/kanun/445/ozelge/36832

## Local run

### 1. Python API

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

### 2. Frontend

In another terminal:

```bash
python -m http.server 8080 --directory site
```

Open `http://127.0.0.1:8080`.

## Deploy the API on Render

1. Push the repository to GitHub.
2. In Render, create a Blueprint from the repository or create a Python Web Service using the root `render.yaml`.
3. Confirm `/health` returns `status: ok`.
4. Copy the Render service URL.

## Point Netlify to the API

Edit `site/config.js`:

```javascript
window.APP_CONFIG = {
  API_BASE_URL: "https://YOUR-RENDER-SERVICE.onrender.com"
};
```

Commit and push.

## Deploy the frontend on Netlify

Import the same GitHub repository in Netlify. `netlify.toml` publishes `site/` directly. No npm install and no frontend build command are required.

## Excel export

The Export Center returns either Turkish or English `.xlsx` output. Calculation cells are frozen as values only:

- no VBA/macros,
- no model calculation formulas,
- input snapshot,
- official tax registry,
- borrower and investment results,
- lender economics,
- net carry and break-even,
- loan curve and maturity ladder,
- inflation/real cost,
- scenarios,
- sensitivity,
- methodology,
- sources.

Native chart objects may reference report cells for display, but there are no calculation formulas in cells.

## Quality checks

```bash
cd backend
PYTHONPATH=. pytest -q
node --check ../site/app.js
```

Reference corporate case tested:

- TLREF nominal: 40.00%
- TLREF effective annual: about 49.1498%
- Borrower cash cost: TRY 420,000
- Borrower after-tax cost: TRY 315,000
- Corporate after-tax investment income: about TRY 368,623
- Net carry: about TRY 53,623





## v0.1.6 institutional term-structure and macro-data architecture

- The full official Borsa Istanbul daily TLREF CSV history is bundled as the permanent **Historical TLREF Engine** and merged with newly parsed official BIST web observations. The bundled series runs from 2018-12-28 through 2026-10-02, with the latest bundled TLREF fixing at 36.8433%.
- The latest valid BIST TLREF fixing is the overnight **ON anchor**. A single ON fixing is never extrapolated into a fabricated 1W-10Y curve.
- TCMB Market Participants Survey / EVDS is integrated for the **12-month expected CPI** input. The September 2026 official survey snapshot is 23.70%; the user can refresh/restore the official value or override it manually.
- The curve source hierarchy is explicit: **observed VIOP TLREF futures / swap / user-market tenor node > TCMB PKA TLREF-equivalent survey proxy > NS/Svensson interpolation inside the supported horizon only**.
- TCMB PKA policy-rate expectations are not treated as if they were TLREF fixings. They are converted into transparent TLREF-equivalent survey proxies using the current observed **TLREF minus TCMB policy-rate basis**. With the bundled 2026-10-02 TLREF of 36.8433% and the current TCMB policy rate of 37.00%, the basis is -15.67 bp.
- Survey proxy nodes are labelled as survey proxies, never as exchange-traded forward prices. Actual VIOP/swap/user market quotes override survey proxies at matching tenors.
- Nelson-Siegel and Svensson remain genuine parametric fits. They use bounded nonlinear least squares and, when input anchors are monotone, a shape penalty discourages economically spurious reversals without replacing the fitted curve with a non-parametric post-processing spline.
- The default engine does **not extrapolate beyond the last supported benchmark anchor**. The 10Y TRY government-bond yield remains a reference marker unless the user explicitly supplies/promotes it as a base-rate node.
- The all-in loan curve remains: `q_loan(T) = y_benchmark(T) + base credit spread + tenor spread + liquidity premium + capital charge + annualised fee equivalent`. BSMV, KKDF, tax shield and 12M expected CPI are applied after the quoted curve.
- `Investment / TLREF` now carries the permanent historical TLREF time series with 1M / 6M / 1Y / 5Y / ALL ranges, 21D and 63D rolling averages and realized one-year TLREF compounding.
- The backend exposes `/market/tlref` and `/market/macro`; the frontend can refresh BIST and TCMB data independently. When a machine-readable live source is unavailable, the app falls back to clearly labelled official snapshots instead of inventing data.
- Borsa Istanbul officially lists 1-Month TLREF futures with the current month plus the nearest six contract months. The architecture accepts these as the highest-priority short-end market nodes, but this build does not fabricate live futures settlement prices when a reliable public machine-readable price feed is unavailable.
- Current quality gate: **13 backend tests passed** plus JavaScript syntax validation.

## v0.1.5 curve identification fix

- A single live TLREF spot observation is no longer rendered as a fake flat 1W-10Y yield curve.
- NS/Svensson are suppressed until explicit tenor-specific quote nodes exist.
- Base Credit Spread is treated as a parallel shift only; maturity slope must come from tenor-specific spread/liquidity/capital/fee nodes or real forward-market observations.
- The curve page now shows an explicit ANCHOR ONLY / TERM DATA REQUIRED status when the term structure is not identified.
- Historical TLREF remains a separate time-series chart sourced from Borsa Istanbul.

## v0.1.4 official TLREF web feed and chart visibility

- Default TLREF source is now the official Borsa Istanbul TLREF web page, fetched server-side by the FastAPI backend through `/market/tlref`.
- Latest official observation becomes the overnight TLREF anchor automatically; the user can still type a manual override or restore/refresh the official rate.
- If the live web fetch is unavailable, the backend falls back to a bundled official Borsa Istanbul CSV snapshot and clearly marks that status. The bundled snapshot in this build is current through 2026-10-02 (36.8433%).
- Investment / TLREF now includes a separate official historical TLREF time-series chart. It is intentionally separated from the cross-sectional 1W-10Y loan-cost curve.
- Loan Cost Curve chart now applies an explicit y-axis pad and draws the raw all-in quote last, so flat curves remain visible instead of collapsing at the plot boundary.
- Turkish flag artwork is smaller, solid-color SVG and uses geometric precision for a sharper institutional header/sidebar rendering.

## v0.1.3 curve and branding fixes

- Sidebar/header emblem switched from the silver crescent-star mark to a Turkish flag visual.
- NS / Svensson display now includes a shape-preserving monotone guard: if raw tenor quote nodes are flat or monotone and the unconstrained fit falsely turns down/up, the displayed fit is guarded so it remains economically coherent.
- Curve chart snapshot annotation spacing was revised to avoid label collisions.

## v0.1.2 methodology update

- Methodology page now contains the full TLREF-anchored raw-node construction, Nelson-Siegel and Svensson equations, parameter interpretation, nonlinear least-squares calibration, RMSE diagnostic, cash-cost separation and flat-curve sanity rule in both EN/TR.
- Value-only Excel methodology export contains the same curve framework in the selected language.

## v0.1.1 fixes

- Input Center now synchronizes values on input/change and re-reads all visible fields before RUN ANALYSIS. Enter also runs the model.
- EN/TR and Dark/Light controls use persistent delegated events and visibly stronger active states.
- Base Credit Spread is a dedicated, separate input. In TLREF + Spread mode the active nominal loan rate is TLREF + Base Credit Spread; the direct loan-rate field is disabled.
- Loan quote curve no longer fits maturity-dependent cash-cost annualisation. NS/Svensson are fitted to the quoted curve: TLREF + base spread + tenor adjustment + liquidity + capital + annualised fee equivalent.
- Dashboard curve labels/legend spacing revised to prevent collisions.
- TLREF curve is explicitly labelled as a loan quote curve, not historical TLREF. Official Borsa Istanbul TLREF source is linked in Input Center and Sources.
