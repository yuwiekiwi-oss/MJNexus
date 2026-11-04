import pytest

from mj_analytics import get_kpi, load_catalog
from mj_analytics.data_quality import ANECDOTAL_MAX, DESCRIPTIVE_MAX


def test_catalog_loads_and_ids_are_unique():
    catalog = load_catalog()
    assert "engagement_rate_reach" in catalog
    assert all(k.version >= 1 for k in catalog.values())


def test_domains_are_separated():
    domains = {k.domain for k in load_catalog().values()}
    assert domains == {"social", "business"}


def test_rate_kpis_have_denominator():
    for k in load_catalog().values():
        if k.unit == "percent":
            assert k.denominator, k.id


def test_business_kpi_status_by_phase():
    # Phase 3: 集客ファネルは実装済み（SQL関数 marketing_funnel）。売上・利益は Phase 4 で未実装
    catalog = load_catalog()
    for kid in ("inquiries", "trial_booking_rate", "conversion_inquiry_to_enrollment", "cpa", "cac"):
        assert catalog[kid].status == "implemented", kid
        assert catalog[kid].source.startswith("marketing_funnel."), kid
    for kid in ("roas", "monthly_revenue", "operating_margin"):
        assert catalog[kid].status == "planned", kid


def test_get_kpi_unknown():
    with pytest.raises(KeyError):
        get_kpi("no_such_kpi")


def test_sample_thresholds_match_frontend():
    # src/lib/stats.ts の sampleSizeLevel と同じ閾値
    assert (ANECDOTAL_MAX, DESCRIPTIVE_MAX) == (9, 29)
