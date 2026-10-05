from app.engine import simulate
from app.models import SimulationInput


def survey_nodes():
    return [
        {"label": "ON", "days": 1, "base_rate": 0.368433, "base_source": "BIST TLREF", "base_source_type": "bist_tlref"},
        {"label": "OCT26", "days": 17, "base_rate": 0.358433, "base_source": "TCMB PKA TLREF proxy", "base_source_type": "tcmb_pka"},
        {"label": "DEC26", "days": 66, "base_rate": 0.349133, "base_source": "TCMB PKA TLREF proxy", "base_source_type": "tcmb_pka"},
        {"label": "12M", "days": 341, "base_rate": 0.290633, "base_source": "TCMB PKA TLREF proxy", "base_source_type": "tcmb_pka"},
        {"label": "DEC27", "days": 452, "base_rate": 0.270033, "base_source": "TCMB PKA TLREF proxy", "base_source_type": "tcmb_pka"},
        {"label": "24M", "days": 707, "base_rate": 0.222733, "base_source": "TCMB PKA TLREF proxy", "base_source_type": "tcmb_pka"},
    ]


def test_corporate_reference_case():
    inp = SimulationInput(
        investor_type="corporate",
        pricing_mode="direct",
        principal=1_000_000,
        days=365,
        tlref=0.40,
        direct_loan_rate=0.40,
        bsmv_rate=0.05,
        kkdf_rate=0.0,
        withholding_rate=0.15,
        corporate_tax_rate=0.25,
        deductible_ratio=1.0,
    )
    r = simulate(inp)
    assert round(r["investment"]["gross_effective_annual"], 6) == round((1 + 0.40 / 365) ** 365 - 1, 6)
    assert round(r["borrower"]["cash_cost"], 2) == 420000.00
    assert round(r["borrower"]["after_tax_cost"], 2) == 315000.00
    assert round(r["investment"]["after_tax_income"], 2) == round(r["investment"]["gross_income"] * 0.75, 2)


def test_individual_withholding_case():
    inp = SimulationInput(
        investor_type="individual",
        pricing_mode="direct",
        principal=1_000_000,
        days=365,
        tlref=0.40,
        direct_loan_rate=0.40,
        bsmv_rate=0.05,
        kkdf_rate=0.0,
        withholding_rate=0.15,
    )
    r = simulate(inp)
    expected = r["investment"]["gross_income"] * 0.85
    assert round(r["investment"]["after_tax_income"], 2) == round(expected, 2)
    assert r["kpis"]["net_carry_amount"] < 0


def test_tlref_spread_is_separate_from_direct_rate():
    inp = SimulationInput(
        pricing_mode="tlref_spread",
        tlref=0.36,
        credit_spread=0.045,
        direct_loan_rate=0.99,
        days=365,
    )
    r = simulate(inp)
    assert round(r["borrower"]["nominal_rate"], 6) == 0.405


def test_single_spot_anchor_does_not_fabricate_term_structure():
    inp = SimulationInput(tlref=0.40, credit_spread=0.05)
    r = simulate(inp)
    c = r["curve"]
    assert c["curve_status"] == "insufficient_term_nodes"
    assert c["fitted"]["grid"] == []
    assert c["observed_node_count"] == 1
    on = next(x for x in c["rows"] if x["label"] == "ON")
    assert abs(on["base_rate"] - 0.40) < 1e-12
    assert abs(on["all_in_quote_rate"] - 0.45) < 1e-12
    assert all(x["all_in_quote_rate"] is None for x in c["rows"] if x["label"] != "ON")


def test_survey_anchored_curve_produces_ns_and_svensson_without_long_extrapolation():
    inp = SimulationInput(tlref=0.368433, credit_spread=0.05, tenor_points=survey_nodes())
    r = simulate(inp)
    c = r["curve"]
    assert c["curve_status"] == "term_structure_available"
    assert c["observed_node_count"] == 6
    assert c["max_fit_days"] == 707
    assert c["fitted"]["ns"] is not None
    assert c["fitted"]["svensson"] is not None
    assert len(c["fitted"]["grid"]) == 240
    assert max(row["days"] for row in c["fitted"]["grid"]) <= 707


def test_monotone_survey_path_keeps_ns_and_svensson_nonincreasing():
    inp = SimulationInput(tlref=0.368433, credit_spread=0.0, tenor_points=survey_nodes())
    c = simulate(inp)["curve"]
    for key in ("ns", "svensson"):
        vals = [row[key] for row in c["fitted"]["grid"] if row.get(key) is not None]
        assert vals
        assert max(vals[i + 1] - vals[i] for i in range(len(vals) - 1)) <= 1e-7


def test_user_long_end_node_extends_fit_horizon():
    nodes = survey_nodes() + [
        {"label": "10Y", "days": 3650, "base_rate": 0.30, "base_source": "User market 10Y", "base_source_type": "user_market"}
    ]
    c = simulate(SimulationInput(tlref=0.368433, tenor_points=nodes))["curve"]
    assert c["max_fit_days"] == 3650
    assert c["curve_status"] == "term_structure_available"
