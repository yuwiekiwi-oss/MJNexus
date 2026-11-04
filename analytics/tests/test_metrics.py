import math

import pandas as pd
import pytest

from mj_analytics import latest_snapshot_values, safe_rate


class TestSafeRate:
    def test_scalar(self):
        assert safe_rate(5, 100) == 0.05
        assert safe_rate(0, 100) == 0.0

    def test_scalar_zero_or_missing_denominator_is_nan(self):
        assert math.isnan(safe_rate(5, 0))
        assert math.isnan(safe_rate(5, float("nan")))
        assert math.isnan(safe_rate(float("nan"), 10))

    def test_series(self):
        num = pd.Series([5, 0, 3, None])
        den = pd.Series([100, 100, 0, 10])
        out = safe_rate(num, den)
        assert out.iloc[0] == 0.05
        assert out.iloc[1] == 0.0
        assert math.isnan(out.iloc[2])  # 分母0 → 計算不能
        assert math.isnan(out.iloc[3])  # 分子欠損 → 計算不能


def _values():
    return pd.DataFrame(
        [
            # post A: views は 24h=120, 72h=300 → 最新は 300
            ("A", "views", "2026-11-02T10:00:00Z", "measured", 120),
            ("A", "views", "2026-11-04T10:00:00Z", "measured", 300),
            # likes は実測0
            ("A", "likes", "2026-11-02T10:00:00Z", "measured", 0),
            # link_clicks は未取得 → 値は NaN（0 ではない）
            ("A", "link_clicks", "2026-11-04T10:00:00Z", "not_collected", None),
            ("B", "views", "2026-11-03T10:00:00Z", "measured", 50),
        ],
        columns=["post_id", "metric", "recorded_at", "status", "value"],
    )


class TestLatestSnapshotValues:
    def test_takes_latest_per_post_and_metric(self):
        out = latest_snapshot_values(_values()).set_index(["post_id", "metric"])
        assert out.loc[("A", "views"), "value"] == 300
        assert out.loc[("B", "views"), "value"] == 50
        assert len(out) == 4

    def test_sum_of_latest_avoids_double_counting(self):
        out = latest_snapshot_values(_values())
        assert out.loc[out.metric == "views", "value"].sum() == 350  # 120 を足さない

    def test_measured_zero_vs_not_collected(self):
        out = latest_snapshot_values(_values()).set_index(["post_id", "metric"])
        assert out.loc[("A", "likes"), "value"] == 0
        assert math.isnan(out.loc[("A", "link_clicks"), "value"])

    def test_rejects_measured_without_value(self):
        df = _values()
        df.loc[0, "value"] = None
        with pytest.raises(ValueError, match="measured"):
            latest_snapshot_values(df)

    def test_rejects_unknown_status(self):
        df = _values()
        df.loc[0, "status"] = "zero"
        with pytest.raises(ValueError, match="unknown status"):
            latest_snapshot_values(df)

    def test_missing_columns(self):
        with pytest.raises(ValueError, match="missing columns"):
            latest_snapshot_values(pd.DataFrame({"post_id": []}))
