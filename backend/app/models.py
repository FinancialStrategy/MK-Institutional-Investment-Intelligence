from __future__ import annotations

from typing import Literal
from datetime import date

from pydantic import BaseModel, Field


class ScenarioInput(BaseModel):
    name: str
    probability: float = Field(ge=0, le=1)
    tlref: float = Field(ge=-0.99, le=5)
    credit_spread: float = Field(ge=-1, le=5)
    inflation: float = Field(ge=-0.99, le=5)


class TenorPoint(BaseModel):
    label: str
    days: int = Field(gt=0, le=36500)
    base_rate: float | None = Field(default=None, ge=-0.99, le=5)
    base_source: str | None = None
    base_source_type: Literal[
        "bist_tlref", "viop_futures", "tcmb_pka", "swap", "user_market", "government_bond", "model"
    ] | None = None
    credit_spread: float = Field(default=0.0, ge=-1, le=5)
    liquidity_premium: float = Field(default=0.0, ge=-1, le=5)
    capital_charge: float = Field(default=0.0, ge=-1, le=5)
    fee_equivalent: float = Field(default=0.0, ge=-1, le=5)


class SimulationInput(BaseModel):
    language: Literal["en", "tr"] = "en"
    investor_type: Literal["corporate", "individual"] = "corporate"
    loan_type: Literal["commercial", "consumer"] = "commercial"
    pricing_mode: Literal["direct", "tlref_spread"] = "tlref_spread"
    curve_mode: Literal["tcmb_survey", "market_user", "manual"] = "tcmb_survey"
    principal: float = Field(default=1_000_000, gt=0)
    valuation_date: date = date(2026, 10, 5)
    days: int = Field(default=365, gt=0, le=36500)
    tlref: float = Field(default=0.368433, ge=-0.99, le=5)
    direct_loan_rate: float = Field(default=0.40, ge=-0.99, le=5)
    credit_spread: float = Field(default=0.0, ge=-1, le=5)
    inflation: float = Field(default=0.2370, ge=-0.99, le=5)
    inflation_12m_expectation: float = Field(default=0.2370, ge=-0.99, le=5)
    ten_year_bond_yield: float = Field(default=0.30, ge=-0.99, le=5)
    bsmv_rate: float = Field(default=0.05, ge=0, le=1)
    kkdf_rate: float = Field(default=0.0, ge=0, le=1)
    withholding_rate: float = Field(default=0.15, ge=0, le=1)
    corporate_tax_rate: float = Field(default=0.25, ge=0, le=1)
    lender_tax_rate: float = Field(default=0.30, ge=0, le=1)
    deductible_ratio: float = Field(default=1.0, ge=0, le=1)
    upfront_fee_rate: float = Field(default=0.0, ge=0, le=1)
    commission_rate: float = Field(default=0.0, ge=0, le=1)
    lender_funding_rate: float = Field(default=0.33, ge=-0.99, le=5)
    lender_ecl_rate: float = Field(default=0.015, ge=0, le=1)
    lender_opex_rate: float = Field(default=0.005, ge=0, le=1)
    lender_capital_rate: float = Field(default=0.01, ge=0, le=1)
    scenarios: list[ScenarioInput] = []
    tenor_points: list[TenorPoint] = []


class ExportRequest(BaseModel):
    input: SimulationInput
    result: dict
    language: Literal["en", "tr"] = "en"
