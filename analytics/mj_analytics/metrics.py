"""指標値の扱い（SQL側の定義と同じ規則をPythonでも守る）。

DB の social_post_metric_values は
    status ∈ {measured, not_collected, unsupported}
    value  は status = measured のときだけ値を持つ
という規則で保存されている。行が存在しない場合は「未記録」。
分析時は「取れていない値」を 0 として扱わず、NaN（欠損）として扱う。
"""

from __future__ import annotations

from enum import Enum

import numpy as np
import pandas as pd


class MetricStatus(str, Enum):
    MEASURED = "measured"
    NOT_COLLECTED = "not_collected"
    UNSUPPORTED = "unsupported"


def safe_rate(numerator: pd.Series | float, denominator: pd.Series | float) -> pd.Series | float:
    """比率 = 分子 / 分母。

    分母が 0・欠損、または分子が欠損のときは NaN（計算不能）を返す。
    0% と「計算できない」を区別するため、0 で埋めない。
    """
    num = pd.to_numeric(numerator) if isinstance(numerator, pd.Series) else numerator
    den = pd.to_numeric(denominator) if isinstance(denominator, pd.Series) else denominator
    if isinstance(num, pd.Series) or isinstance(den, pd.Series):
        num_s = num.astype("float64") if isinstance(num, pd.Series) else float(num)
        den_s = den.astype("float64") if isinstance(den, pd.Series) else float(den)
        out = num_s / den_s
        if isinstance(den_s, pd.Series):
            out = out.where(den_s != 0)
        elif den_s == 0:
            out = out * np.nan
        return out
    if num is None or den is None or pd.isna(num) or pd.isna(den) or den == 0:
        return float("nan")
    return float(num) / float(den)


def latest_snapshot_values(values: pd.DataFrame) -> pd.DataFrame:
    """投稿 × 指標ごとに最新の記録だけを取り出す。

    SNS実績は累積値なので、複数時点の記録を合計すると二重計上になる。
    SQLビュー public.social_post_latest_metric_values と同じ結果を返す（相互検証用）。

    Parameters
    ----------
    values : 列 post_id, metric, recorded_at, status, value を持つ DataFrame

    Returns
    -------
    同じ列を持ち、(post_id, metric) が一意な DataFrame。
    未取得・非対応の value は NaN。
    """
    required = {"post_id", "metric", "recorded_at", "status", "value"}
    missing = required - set(values.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")

    df = values.copy()
    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    valid_status = {s.value for s in MetricStatus}
    bad = ~df["status"].isin(valid_status)
    if bad.any():
        raise ValueError(f"unknown status values: {sorted(df.loc[bad, 'status'].unique())}")

    measured = df["status"] == MetricStatus.MEASURED.value
    if df.loc[measured, "value"].isna().any():
        raise ValueError("measured rows must have a value")
    df["value"] = pd.to_numeric(df["value"]).where(measured)

    df = df.sort_values(["post_id", "metric", "recorded_at"])
    latest = df.groupby(["post_id", "metric"], as_index=False, sort=True).tail(1)
    return latest.reset_index(drop=True)
