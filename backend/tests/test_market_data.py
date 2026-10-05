from app.market_data import (
    load_bundled_tlref_history,
    parse_bist_tlref_html,
    parse_tcmb_12m_inflation_html,
    build_policy_proxy_nodes,
)


def test_parse_bist_tlref_html_table():
    html = '''
    <table><tr><th>Date</th><th>TLREF Rate</th></tr>
    <tr><td>10.02.2026</td><td>36.8433</td></tr>
    <tr><td>10.01.2026</td><td>36.8196</td></tr></table>
    '''
    rows = parse_bist_tlref_html(html)
    assert rows[-1]["date"] == "2026-10-02"
    assert abs(rows[-1]["rate"] - 0.368433) < 1e-12


def test_full_official_tlref_csv_is_loaded_and_latest_is_2026_10_02():
    rows = load_bundled_tlref_history()
    assert len(rows) > 1900
    assert rows[0]["date"] == "2018-12-28"
    assert rows[-1]["date"] == "2026-10-02"
    assert abs(rows[-1]["rate"] - 0.368433) < 1e-12


def test_parse_tcmb_12m_expectation_from_evds_homepage_fragment():
    html = '''<div>Piyasa Katılımcılarının 12 Ay Sonrası Yıllık TÜFE Beklentisi (%) 23,70 EYLÜL 2026</div>'''
    parsed = parse_tcmb_12m_inflation_html(html)
    assert parsed is not None
    assert abs(parsed["value"] - 0.2370) < 1e-12
    assert parsed["period"] == "2026-09"


def test_policy_expectations_are_converted_to_tlref_equivalent_proxy():
    snapshot = {
        "source": "TCMB PKA",
        "current_policy_rate": 0.37,
        "policy_rate_anchors": [
            {"label": "DEC26", "target_date": "2026-12-10", "policy_rate": 0.3507}
        ],
    }
    current_policy, basis, nodes = build_policy_proxy_nodes(snapshot, 0.368433)
    assert abs(current_policy - 0.37) < 1e-12
    assert abs(basis - (-0.001567)) < 1e-12
    assert abs(nodes[0]["policy_rate"] - 0.3507) < 1e-12
    assert abs(nodes[0]["tlref_proxy_rate"] - 0.349133) < 1e-12
    assert nodes[0]["source_type"] == "tcmb_pka"
