from __future__ import annotations

import copy
from math import isfinite
from datetime import timedelta

import numpy as np
from scipy.optimize import brentq

from .curves import build_fitted_curve
from .models import SimulationInput, TenorPoint


def annualize_period_return(period_return: float, days: int) -> float:
    if days <= 0:
        return 0.0
    base = 1.0 + period_return
    if base <= 0:
        return -1.0
    return base ** (365.0 / days) - 1.0


def tlref_period_return(tlref: float, days: int) -> float:
    daily = tlref / 365.0
    if 1.0 + daily <= 0:
        return -1.0
    return (1.0 + daily) ** days - 1.0


def loan_nominal_rate(inp: SimulationInput) -> float:
    if inp.pricing_mode == "tlref_spread":
        return inp.tlref + inp.credit_spread
    return inp.direct_loan_rate


def borrower_block(inp: SimulationInput, nominal_rate: float | None = None) -> dict:
    rate = loan_nominal_rate(inp) if nominal_rate is None else nominal_rate
    year_fraction = inp.days / 365.0
    interest = inp.principal * rate * year_fraction
    bsmv = interest * inp.bsmv_rate
    kkdf = interest * inp.kkdf_rate
    upfront_fee = inp.principal * inp.upfront_fee_rate
    commission = inp.principal * inp.commission_rate
    cash_cost = interest + bsmv + kkdf + upfront_fee + commission
    deductible_cost = cash_cost * inp.deductible_ratio
    tax_shield = deductible_cost * inp.corporate_tax_rate if inp.investor_type == "corporate" else 0.0
    after_tax_cost = cash_cost - tax_shield

    cash_period_rate = cash_cost / inp.principal
    after_tax_period_rate = after_tax_cost / inp.principal
    cash_effective_annual = annualize_period_return(cash_period_rate, inp.days)
    after_tax_effective_annual = annualize_period_return(after_tax_period_rate, inp.days)
    real_after_tax = (1.0 + after_tax_effective_annual) / (1.0 + inp.inflation_12m_expectation) - 1.0

    return {
        "nominal_rate": rate,
        "interest": interest,
        "bsmv": bsmv,
        "kkdf": kkdf,
        "upfront_fee": upfront_fee,
        "commission": commission,
        "cash_cost": cash_cost,
        "cash_period_rate": cash_period_rate,
        "cash_effective_annual": cash_effective_annual,
        "deductible_cost": deductible_cost,
        "tax_shield": tax_shield,
        "after_tax_cost": after_tax_cost,
        "after_tax_period_rate": after_tax_period_rate,
        "after_tax_effective_annual": after_tax_effective_annual,
        "real_after_tax_effective": real_after_tax,
    }


def investment_block(inp: SimulationInput, tlref: float | None = None) -> dict:
    rate = inp.tlref if tlref is None else tlref
    gross_period_rate = tlref_period_return(rate, inp.days)
    gross_income = inp.principal * gross_period_rate
    gross_effective_annual = annualize_period_return(gross_period_rate, inp.days)
    withholding_cash = gross_income * inp.withholding_rate

    if inp.investor_type == "individual":
        corporate_tax_liability = 0.0
        withholding_credit = 0.0
        additional_tax_payable = 0.0
        tax_receivable = 0.0
        economic_tax = withholding_cash
        after_tax_income = gross_income - withholding_cash
    else:
        corporate_tax_liability = gross_income * inp.corporate_tax_rate
        withholding_credit = min(withholding_cash, corporate_tax_liability)
        additional_tax_payable = max(corporate_tax_liability - withholding_cash, 0.0)
        tax_receivable = max(withholding_cash - corporate_tax_liability, 0.0)
        economic_tax = corporate_tax_liability
        after_tax_income = gross_income - corporate_tax_liability

    after_tax_period_rate = after_tax_income / inp.principal
    after_tax_effective_annual = annualize_period_return(after_tax_period_rate, inp.days)
    real_after_tax = (1.0 + after_tax_effective_annual) / (1.0 + inp.inflation_12m_expectation) - 1.0

    return {
        "tlref": rate,
        "gross_period_rate": gross_period_rate,
        "gross_income": gross_income,
        "gross_effective_annual": gross_effective_annual,
        "withholding_cash": withholding_cash,
        "corporate_tax_liability": corporate_tax_liability,
        "withholding_credit": withholding_credit,
        "additional_tax_payable": additional_tax_payable,
        "tax_receivable": tax_receivable,
        "economic_tax": economic_tax,
        "after_tax_income": after_tax_income,
        "after_tax_period_rate": after_tax_period_rate,
        "after_tax_effective_annual": after_tax_effective_annual,
        "real_after_tax_effective": real_after_tax,
    }


def lender_block(inp: SimulationInput, nominal_rate: float | None = None) -> dict:
    rate = loan_nominal_rate(inp) if nominal_rate is None else nominal_rate
    yf = inp.days / 365.0
    interest_income = inp.principal * rate * yf
    funding_cost = inp.principal * inp.lender_funding_rate * yf
    ecl = inp.principal * inp.lender_ecl_rate * yf
    opex = inp.principal * inp.lender_opex_rate * yf
    capital = inp.principal * inp.lender_capital_rate * yf
    pre_tax_profit = interest_income - funding_cost - ecl - opex - capital
    tax = max(pre_tax_profit, 0.0) * inp.lender_tax_rate
    after_tax_profit = pre_tax_profit - tax
    min_required_rate = inp.lender_funding_rate + inp.lender_ecl_rate + inp.lender_opex_rate + inp.lender_capital_rate
    min_required_spread = min_required_rate - inp.tlref
    actual_spread = rate - inp.tlref
    return {
        "interest_income": interest_income,
        "funding_cost": funding_cost,
        "ecl": ecl,
        "opex": opex,
        "capital_liquidity_charge": capital,
        "pre_tax_profit": pre_tax_profit,
        "tax": tax,
        "after_tax_profit": after_tax_profit,
        "min_required_rate": min_required_rate,
        "min_required_spread": min_required_spread,
        "actual_spread": actual_spread,
        "spread_headroom": actual_spread - min_required_spread,
    }


def break_even_loan_rate(inp: SimulationInput, target_after_tax_income: float) -> float | None:
    def objective(rate: float) -> float:
        return borrower_block(inp, nominal_rate=rate)["after_tax_cost"] - target_after_tax_income

    lo, hi = -0.50, 5.00
    flo, fhi = objective(lo), objective(hi)
    if not (isfinite(flo) and isfinite(fhi)) or flo * fhi > 0:
        return None
    return float(brentq(objective, lo, hi, maxiter=500))


def _interp_fit_value(fitted: dict, days: int, key: str | None = None) -> float | None:
    grid = fitted.get("grid", []) if fitted else []
    if not grid:
        return None
    if key is None:
        key = "svensson" if any(r.get("svensson") is not None for r in grid) else "ns"
    pairs = [(float(r["days"]), float(r[key])) for r in grid if r.get(key) is not None]
    if not pairs:
        return None
    xs = np.array([x for x, _ in pairs], dtype=float)
    ys = np.array([y for _, y in pairs], dtype=float)
    if days < xs.min() or days > xs.max():
        return None
    return float(np.interp(float(days), xs, ys))


def curve_rows(inp: SimulationInput) -> dict:
    points = [copy.deepcopy(p) for p in (inp.tenor_points or default_tenor_points())]
    if not points:
        points = default_tenor_points()

    # The overnight node is always the observed current TLREF anchor.
    on_found = False
    for p in points:
        if p.label.upper() == "ON" or p.days == 1:
            p.base_rate = inp.tlref
            p.base_source = "Borsa Istanbul TLREF"
            p.base_source_type = "bist_tlref"
            on_found = True
            break
    if not on_found:
        points.insert(0, TenorPoint(label="ON", days=1, base_rate=inp.tlref, base_source="Borsa Istanbul TLREF", base_source_type="bist_tlref"))

    observed = sorted([p for p in points if p.base_rate is not None], key=lambda p: p.days)
    observed_days = [p.days for p in observed]
    observed_rates = [float(p.base_rate) for p in observed]
    unique_observed = len({p.days for p in observed})

    if unique_observed >= 4:
        benchmark_fitted = build_fitted_curve(observed_days, observed_rates)
        benchmark_status = "benchmark_term_structure_available"
    else:
        benchmark_fitted = {"ns": None, "svensson": None, "grid": [], "shape": "insufficient_nodes"}
        benchmark_status = "insufficient_benchmark_nodes"

    min_fit_day = min(observed_days) if observed_days else None
    max_fit_day = max(observed_days) if observed_days else None
    observed_by_day = {p.days: p for p in observed}

    rows: list[dict] = []
    loan_fit_days: list[int] = []
    loan_fit_yields: list[float] = []
    raw_nodes: list[dict] = []

    for point in sorted(points, key=lambda p: p.days):
        observed_point = observed_by_day.get(point.days)
        if observed_point is not None:
            base_rate = float(observed_point.base_rate)
            base_source = observed_point.base_source or "Observed node"
            base_source_type = observed_point.base_source_type or "user_market"
            node_kind = "observed"
        else:
            base_rate = _interp_fit_value(benchmark_fitted, point.days)
            base_source = "NS/Svensson benchmark interpolation" if base_rate is not None else None
            base_source_type = "model" if base_rate is not None else None
            node_kind = "model_interpolated" if base_rate is not None else "outside_fit_range"

        total_credit_spread = inp.credit_spread + point.credit_spread
        all_in_quote_rate = None
        b = None
        if base_rate is not None:
            all_in_quote_rate = (
                base_rate
                + total_credit_spread
                + point.liquidity_premium
                + point.capital_charge
                + point.fee_equivalent
            )
            local = copy.deepcopy(inp)
            local.days = point.days
            local.direct_loan_rate = all_in_quote_rate
            local.pricing_mode = "direct"
            b = borrower_block(local, nominal_rate=all_in_quote_rate)
            loan_fit_days.append(point.days)
            loan_fit_yields.append(all_in_quote_rate)

        row = {
            "label": point.label,
            "days": point.days,
            "years": point.days / 365.0,
            "maturity_date": (inp.valuation_date + timedelta(days=point.days)).isoformat(),
            "tlref": inp.tlref,
            "base_rate": base_rate,
            "base_source": base_source,
            "base_source_type": base_source_type,
            "node_kind": node_kind,
            "base_credit_spread": inp.credit_spread,
            "credit_spread": total_credit_spread,
            "tenor_spread_adjustment": point.credit_spread,
            "liquidity_premium": point.liquidity_premium,
            "capital_charge": point.capital_charge,
            "fee_equivalent": point.fee_equivalent,
            "all_in_quote_rate": all_in_quote_rate,
            "nominal_loan_rate": all_in_quote_rate,
            "cash_effective_annual": b["cash_effective_annual"] if b else None,
            "after_tax_effective_annual": b["after_tax_effective_annual"] if b else None,
            "real_after_tax_effective": b["real_after_tax_effective"] if b else None,
            "ten_year_bond_spread": (b["after_tax_effective_annual"] - inp.ten_year_bond_yield) if b else None,
        }
        rows.append(row)
        if observed_point is not None:
            raw_nodes.append(
                {
                    "label": point.label,
                    "days": point.days,
                    "rate": base_rate,
                    "all_in_quote_rate": all_in_quote_rate,
                    "source": base_source,
                    "source_type": base_source_type,
                }
            )

    if len(set(loan_fit_days)) >= 4 and len({round(float(v), 10) for v in loan_fit_yields}) >= 2:
        fitted = build_fitted_curve(loan_fit_days, loan_fit_yields)
        curve_status = "term_structure_available"
        curve_message = "NS/Svensson fitted to an observed/survey-anchored benchmark curve plus explicit loan pricing overlays."
    else:
        fitted = {"ns": None, "svensson": None, "grid": [], "shape": "insufficient_nodes"}
        curve_status = "insufficient_term_nodes"
        curve_message = "At least four distinct benchmark/market tenor nodes are required for Nelson-Siegel; six are required for Svensson."

    return {
        "rows": rows,
        "raw_nodes": raw_nodes,
        "benchmark_fitted": benchmark_fitted,
        "fitted": fitted,
        "basis": "Observed benchmark nodes (BIST TLREF / TCMB PKA / market-user) + base credit spread + tenor spread + liquidity + capital + fee equivalent",
        "fit_metric": "all_in_quote_rate",
        "curve_status": curve_status,
        "benchmark_status": benchmark_status,
        "curve_message": curve_message,
        "observed_node_count": unique_observed,
        "max_fit_days": max_fit_day,
        "min_fit_days": min_fit_day,
        "curve_mode": inp.curve_mode,
        "ten_year_bond_reference": inp.ten_year_bond_yield,
    }

def scenario_block(inp: SimulationInput) -> dict:
    scenarios = inp.scenarios or default_scenarios(inp)
    total_probability = sum(s.probability for s in scenarios)
    rows = []
    expected_amount = 0.0
    positive_probability = 0.0

    for s in scenarios:
        local = copy.deepcopy(inp)
        local.tlref = s.tlref
        local.credit_spread = s.credit_spread
        local.inflation = s.inflation
        local.inflation_12m_expectation = s.inflation
        if local.pricing_mode == "direct":
            local.direct_loan_rate = s.tlref + s.credit_spread
        inv = investment_block(local)
        bor = borrower_block(local)
        carry_amount = inv["after_tax_income"] - bor["after_tax_cost"]
        carry_rate = carry_amount / inp.principal
        carry_effective = annualize_period_return(carry_rate, inp.days)
        real_carry = inv["real_after_tax_effective"] - bor["real_after_tax_effective"]
        expected_amount += s.probability * carry_amount
        if carry_amount > 0:
            positive_probability += s.probability
        rows.append(
            {
                "name": s.name,
                "probability": s.probability,
                "tlref": s.tlref,
                "credit_spread": s.credit_spread,
                "inflation": s.inflation,
                "loan_rate": loan_nominal_rate(local),
                "net_carry_amount": carry_amount,
                "net_carry_period_rate": carry_rate,
                "net_carry_effective_annual": carry_effective,
                "real_net_carry_effective": real_carry,
            }
        )

    return {
        "rows": rows,
        "probability_total": total_probability,
        "probability_valid": abs(total_probability - 1.0) < 1e-8,
        "expected_net_carry_amount": expected_amount,
        "expected_net_carry_rate": expected_amount / inp.principal,
        "positive_carry_probability": positive_probability,
    }


def sensitivity_block(inp: SimulationInput) -> dict:
    tlref_offsets = np.array([-0.10, -0.05, 0.0, 0.05, 0.10])
    spread_offsets = np.array([-0.05, -0.025, 0.0, 0.025, 0.05])
    grid = []
    for dt in tlref_offsets:
        row = []
        for ds in spread_offsets:
            local = copy.deepcopy(inp)
            local.tlref = max(-0.99, inp.tlref + float(dt))
            local.credit_spread = inp.credit_spread + float(ds)
            inv = investment_block(local)
            bor = borrower_block(local)
            carry = (inv["after_tax_income"] - bor["after_tax_cost"]) / inp.principal
            row.append(carry)
        grid.append(row)
    return {
        "tlref_values": [float(max(-0.99, inp.tlref + x)) for x in tlref_offsets],
        "spread_values": [float(inp.credit_spread + x) for x in spread_offsets],
        "grid": grid,
    }


def default_tenor_points() -> list[TenorPoint]:
    labels_days = [("ON", 1), ("1W", 7), ("1M", 30), ("3M", 91), ("6M", 182), ("9M", 273), ("1Y", 365), ("15M", 456), ("2Y", 730), ("3Y", 1095), ("5Y", 1825), ("7Y", 2555), ("10Y", 3650)]
    return [TenorPoint(label=label, days=days, credit_spread=0.0, liquidity_premium=0.0, capital_charge=0.0, fee_equivalent=0.0) for label, days in labels_days]


def default_scenarios(inp: SimulationInput):
    from .models import ScenarioInput

    return [
        ScenarioInput(name="Bear", probability=0.20, tlref=max(inp.tlref - 0.08, -0.99), credit_spread=inp.credit_spread + 0.04, inflation=inp.inflation + 0.08),
        ScenarioInput(name="Base", probability=0.50, tlref=inp.tlref, credit_spread=inp.credit_spread, inflation=inp.inflation),
        ScenarioInput(name="Bull", probability=0.30, tlref=inp.tlref + 0.05, credit_spread=inp.credit_spread - 0.02, inflation=max(inp.inflation - 0.05, -0.99)),
    ]


def simulate(inp: SimulationInput) -> dict:
    borrower = borrower_block(inp)
    investment = investment_block(inp)
    lender = lender_block(inp)
    net_carry_amount = investment["after_tax_income"] - borrower["after_tax_cost"]
    net_carry_period_rate = net_carry_amount / inp.principal
    net_carry_effective_annual = annualize_period_return(net_carry_period_rate, inp.days)
    break_even_rate = break_even_loan_rate(inp, investment["after_tax_income"])
    break_even_spread = None if break_even_rate is None else break_even_rate - inp.tlref
    actual_rate = loan_nominal_rate(inp)
    safety_margin = None if break_even_rate is None else break_even_rate - actual_rate

    return {
        "meta": {
            "engine": "MK FinTECH LabGEN Interest Loan Cost Simulator Intelligence",
            "methodology_version": "1.6.0",
        },
        "kpis": {
            "tlref_effective_annual": investment["gross_effective_annual"],
            "all_in_borrowing_effective_annual": borrower["cash_effective_annual"],
            "after_tax_borrowing_effective_annual": borrower["after_tax_effective_annual"],
            "after_tax_investment_effective_annual": investment["after_tax_effective_annual"],
            "net_carry_amount": net_carry_amount,
            "net_carry_period_rate": net_carry_period_rate,
            "net_carry_effective_annual": net_carry_effective_annual,
            "break_even_loan_rate": break_even_rate,
            "break_even_spread": break_even_spread,
            "safety_margin": safety_margin,
            "ten_year_bond_relative_value": investment["after_tax_effective_annual"] - inp.ten_year_bond_yield,
        },
        "borrower": borrower,
        "investment": investment,
        "lender": lender,
        "scenarios": scenario_block(inp),
        "sensitivity": sensitivity_block(inp),
        "curve": curve_rows(inp),
    }
