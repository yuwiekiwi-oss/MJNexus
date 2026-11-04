"""KPIカタログ（shared/kpi-catalog.json）の読み込み。

画面・SQL・Python・AIが同じ id / version / 計算式を参照するため、
Python の分析結果にも kpi_id と formula_version を付けて返す。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

CATALOG_PATH = Path(__file__).resolve().parents[2] / "shared" / "kpi-catalog.json"


@dataclass(frozen=True)
class KpiDefinition:
    id: str
    version: int
    domain: Literal["social", "business"]
    name: str
    formula: str
    denominator: str
    unit: str
    source: str
    status: Literal["implemented", "planned"]
    note: str


@lru_cache(maxsize=1)
def load_catalog(path: Path = CATALOG_PATH) -> dict[str, KpiDefinition]:
    data = json.loads(path.read_text(encoding="utf-8"))
    kpis = [KpiDefinition(**k) for k in data["kpis"]]
    ids = [k.id for k in kpis]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate kpi id in catalog")
    return {k.id: k for k in kpis}


def get_kpi(kpi_id: str) -> KpiDefinition:
    try:
        return load_catalog()[kpi_id]
    except KeyError as e:
        raise KeyError(f"unknown kpi: {kpi_id}") from e
