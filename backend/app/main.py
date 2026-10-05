from __future__ import annotations

from io import BytesIO

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .engine import simulate
from .exporter import build_results_workbook
from .models import ExportRequest, SimulationInput
from .tax_registry import public_registry
from .market_data import fetch_tlref_market_data, fetch_macro_market_data

app = FastAPI(title="MK Interest Loan Cost Simulator Intelligence API", version="1.6.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "interest-loan-cost-simulator-intelligence"}


@app.get("/tax-registry")
def tax_registry():
    return {"rates": public_registry(), "verified_as_of": "2026-10-04"}


@app.get("/market/tlref")
def market_tlref(force: bool = False):
    return fetch_tlref_market_data(force=force)




@app.get("/market/macro")
def market_macro(force: bool = False):
    return fetch_macro_market_data(force=force)

@app.post("/simulate")
def run_simulation(inp: SimulationInput):
    return simulate(inp)


@app.post("/export-xlsx")
def export_xlsx(req: ExportRequest):
    payload = build_results_workbook(req.input, req.result, req.language)
    filename = "Interest_Loan_Cost_Simulator_Result_TR.xlsx" if req.language == "tr" else "Interest_Loan_Cost_Simulator_Result_EN.xlsx"
    return StreamingResponse(
        BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
