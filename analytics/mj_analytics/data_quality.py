"""データ品質の確認: 収集期間・サンプル数・欠損状況。

どの分析でも、結論を出す前に「どれだけのデータに基づくか」を確認する。
データが少ない段階で高度な統計手法を適用すると、偶然のばらつきを
意味のある差と誤認しやすいため、サンプル数に応じた分析レベルを返す。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import pandas as pd

SampleLevel = Literal["none", "anecdotal", "descriptive", "inferential"]

# 目安（docs/analysis-methods.md 参照）。厳密な基準ではなく、過信を防ぐための安全側の閾値。
ANECDOTAL_MAX = 9  # 1〜9件: 個別事例として確認するのみ
DESCRIPTIVE_MAX = 29  # 10〜29件: 記述統計（中央値・範囲）まで


def sample_size_level(n: int) -> SampleLevel:
    """サンプル数から、適用してよい分析のレベルを返す。"""
    if n < 0:
        raise ValueError("n must be >= 0")
    if n == 0:
        return "none"
    if n <= ANECDOTAL_MAX:
        return "anecdotal"
    if n <= DESCRIPTIVE_MAX:
        return "descriptive"
    return "inferential"


@dataclass(frozen=True)
class CoverageReport:
    n_rows: int
    period_start: pd.Timestamp | None
    period_end: pd.Timestamp | None
    missing_rate: dict[str, float] = field(default_factory=dict)
    level: SampleLevel = "none"

    def summary_ja(self) -> str:
        if self.n_rows == 0:
            return "データがありません。"
        assert self.period_start is not None and self.period_end is not None
        missing = "、".join(f"{k}: {v:.0%}" for k, v in self.missing_rate.items() if v > 0) or "なし"
        return (
            f"{self.period_start:%Y-%m-%d} 〜 {self.period_end:%Y-%m-%d} の {self.n_rows} 件"
            f"（欠損: {missing}、分析レベル: {self.level}）"
        )


def coverage_report(df: pd.DataFrame, date_col: str, value_cols: list[str]) -> CoverageReport:
    """収集期間・件数・列ごとの欠損率をまとめる。"""
    for c in [date_col, *value_cols]:
        if c not in df.columns:
            raise ValueError(f"missing column: {c}")
    n = len(df)
    if n == 0:
        return CoverageReport(n_rows=0, period_start=None, period_end=None,
                              missing_rate={c: 0.0 for c in value_cols}, level="none")
    dates = pd.to_datetime(df[date_col], utc=True)
    return CoverageReport(
        n_rows=n,
        period_start=dates.min(),
        period_end=dates.max(),
        missing_rate={c: float(df[c].isna().mean()) for c in value_cols},
        level=sample_size_level(n),
    )
