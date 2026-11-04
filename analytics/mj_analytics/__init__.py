"""MJ Nexus analytics.

フロントエンドから独立した分析ロジック。まずはローカル実行・バッチ処理を想定し、
将来は Edge Function / API から呼び出せるよう、純粋関数（入力DataFrame → 出力）で設計する。
"""

from .data_quality import CoverageReport, coverage_report, sample_size_level
from .metrics import MetricStatus, latest_snapshot_values, safe_rate

__all__ = [
    "CoverageReport",
    "MetricStatus",
    "coverage_report",
    "latest_snapshot_values",
    "safe_rate",
    "sample_size_level",
]
