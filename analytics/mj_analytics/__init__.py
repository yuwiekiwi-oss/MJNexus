"""MJ Nexus analytics.

フロントエンドから独立した分析ロジック。まずはローカル実行・バッチ処理を想定し、
KPIカタログの読み込みとデータ量の確認だけを持つ（純粋関数）。
"""

from .data_quality import CoverageReport, coverage_report, sample_size_level
from .kpi_catalog import KpiDefinition, get_kpi, load_catalog

__all__ = [
    "CoverageReport",
    "KpiDefinition",
    "get_kpi",
    "load_catalog",
    "coverage_report",
    "sample_size_level",
]
