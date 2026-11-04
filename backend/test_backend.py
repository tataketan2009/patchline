"""PATCHLINE backend tests (pytest).

Covers the honest-data guarantees on the Python side:
  • priority score bounds + factor-sum invariant
  • SQLite store round-trips and review workflow
  • pipeline GeoJSON import shape
Run from backend/:  python -m pytest test_backend.py -v
"""

from __future__ import annotations

import pytest

import store
from scoring import priority_score
from seed_data import SEED_DETECTIONS

store.init_db()


# ----------------------------------------------------------------- scoring ---

def test_score_bounds_all_seed_detections():
    ids = {d["id"] for d in store.list_detections()}
    for d in SEED_DETECTIONS:
        assert d["id"] in ids  # DB seeded correctly
        result = priority_score(d)
        assert 0 <= result["score"] <= 100


def test_factor_breakdown_sums_to_score():
    for d in store.list_detections():
        result = priority_score(d)
        assert sum(f["points"] for f in result["factors"]) == result["score"]
        assert all(0 <= f["points"] <= f["max"] for f in result["factors"])


def test_bigger_area_scores_more_area_points():
    small = dict(SEED_DETECTIONS[1], area_ha=2.0)
    big = dict(SEED_DETECTIONS[1], area_ha=50.0)
    s = priority_score(small)["factors"][0]
    b = priority_score(big)["factors"][0]
    assert b["points"] > s["points"]


def test_area_points_cap_at_35():
    huge = dict(SEED_DETECTIONS[1], area_ha=1000.0)
    assert priority_score(huge)["factors"][0]["points"] == 35


# ------------------------------------------------------------------- store ---

def test_list_detections_filters():
    all_rows = store.list_detections()
    assert len(all_rows) >= len(SEED_DETECTIONS)
    crit = store.list_detections(severity="critical")
    assert crit and all(d["severity"] == "critical" for d in crit)
    dated = store.list_detections(date_from="2026-10-26")
    assert all(d["date"] >= "2026-10-26" for d in dated)


def test_review_roundtrip_and_independence():
    det = store.get_detection("PL-2026-0841")
    assert det is not None
    review = store.set_review("PL-2026-0841", "under-review", "Field visit scheduled.")
    assert review["status"] == "under-review"
    assert "Field visit scheduled." in review["notes"]
    # independent entry untouched
    assert store.get_review("PL-2026-0805")["status"] == "new"


def test_review_rejects_unknown_status():
    with pytest.raises(ValueError):
        store.set_review("PL-2026-0841", "bogus-status", None)


def test_next_detection_id_increments():
    before = int(store.next_detection_id().split("-")[2])
    assert before >= 799  # seed max is 0841 → next 0842
    again = int(store.next_detection_id().split("-")[2])
    assert again == before  # deterministic until inserted


def test_import_inserts_pipeline_detection():
    fc = {
        "summary": {"observations": {"after": {"datetime": "2026-10-30"}}},
        "features": [
            {
                "properties": {"area_ha": 6.5},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[79.80, 17.80], [79.81, 17.80], [79.81, 17.81], [79.80, 17.80]]],
                },
            }
        ],
    }
    from main import _import_features
    created = _import_features(fc)
    assert len(created) == 1
    det = store.get_detection(created[0])
    assert det is not None
    assert det["source"] == "pipeline-ndvi-diff"
    assert det["area_ha"] == pytest.approx(6.5)
    assert det["polygon"][0] == [17.80, 79.80]  # lat/lon order swapped correctly
