# Dual UI Architecture — v0.10

The application has one analytics/data state and two presentation profiles.

| UI | Purpose | Visual language |
|---|---|---|
| Classic v0.9 | Analyst / quant daily use | Original v0.9 interface preserved |
| MK LabGEN | Executive / presentation | Premium institutional spacing, orange/white brand accents |

Both support Dark and Light themes. `mk_ui_mode` and `mk_theme` are persisted in localStorage. No calculation is duplicated in the UI layer.

## Brand rule
MK and the project title use thin condensed sans-serif stacks (`Arial Narrow`, `Arial`, `Helvetica Neue`, sans-serif), never Times New Roman. A small Turkish flag is positioned beside the MK mark in the LabGEN lockup. The signature reads `MK FinTECH LabGEN @2026 Istanbul`.
