import pandas as pd
import pytest

from mj_analytics import coverage_report, sample_size_level


@pytest.mark.parametrize(
    ("n", "level"),
    [(0, "none"), (1, "anecdotal"), (9, "anecdotal"), (10, "descriptive"), (29, "descriptive"), (30, "inferential")],
)
def test_sample_size_level(n, level):
    assert sample_size_level(n) == level


def test_sample_size_level_rejects_negative():
    with pytest.raises(ValueError):
        sample_size_level(-1)


def test_coverage_report_empty():
    df = pd.DataFrame({"published_at": [], "reach": []})
    r = coverage_report(df, "published_at", ["reach"])
    assert r.n_rows == 0
    assert r.level == "none"
    assert r.summary_ja() == "データがありません。"


def test_coverage_report_counts_missing():
    df = pd.DataFrame(
        {
            "published_at": ["2026-11-01T10:00:00Z", "2026-11-03T10:00:00Z", "2026-11-05T10:00:00Z", "2026-11-06T10:00:00Z"],
            "reach": [100, None, 50, 0],  # 0 は欠損ではない
            "link_clicks": [None, None, None, None],
        }
    )
    r = coverage_report(df, "published_at", ["reach", "link_clicks"])
    assert r.n_rows == 4
    assert r.period_start == pd.Timestamp("2026-11-01T10:00:00Z")
    assert r.period_end == pd.Timestamp("2026-11-06T10:00:00Z")
    assert r.missing_rate == {"reach": 0.25, "link_clicks": 1.0}
    assert r.level == "anecdotal"
    assert "2026-11-01 〜 2026-11-06 の 4 件" in r.summary_ja()


def test_coverage_report_missing_column():
    with pytest.raises(ValueError, match="missing column"):
        coverage_report(pd.DataFrame({"a": [1]}), "published_at", ["a"])
