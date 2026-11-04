"""PATCHLINE — explainable investigation priority scoring (Python).

Mirrors the frontend weights exactly so scores agree between the static
demo and the Python API. A high score ranks a detection for human review;
it is NEVER a statement about illegal activity.
"""

from __future__ import annotations

import math
from typing import Any

from config import REGION_BOUNDARY
from store import list_detections


def _boundary_distance_km(lat: float, lon: float) -> float:
    """Distance to the nearest sanctuary-boundary vertex (km)."""
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371000.0
        f = math.pi / 180.0
        dlat = (lat2 - lat1) * f
        dlon = (lon2 - lon1) * f
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1 * f) * math.cos(lat2 * f) * math.sin(dlon / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))

    return min(haversine(lat, lon, p[0], p[1]) for p in REGION_BOUNDARY) / 1000.0


def _block_recurrences(region: str) -> int:
    block = region.split(" ")[0]
    return max(sum(1 for d in list_detections() if d["region"].split(" ")[0] == block), 1)


def priority_score(d: dict[str, Any]) -> dict[str, Any]:
    """Weighted 0–100 score with a fully transparent factor breakdown."""
    factors: list[dict[str, Any]] = []

    # 1. Affected area (0–35): larger clearings rank higher.
    area_pts = min(35, round(d["area_ha"] * 0.65))
    factors.append({
        "label": "Affected area", "points": area_pts, "max": 35,
        "detail": f"{d['area_ha']:.1f} ha → {area_pts}/35",
    })

    # 2. Protected-boundary proximity (0–25).
    dist_km = _boundary_distance_km(d["lat"], d["lon"])
    if dist_km <= 2:
        prox_pts = 25
    elif dist_km <= 6:
        prox_pts = 16
    elif dist_km <= 12:
        prox_pts = 8
    else:
        prox_pts = 3
    factors.append({
        "label": "Protected-boundary proximity", "points": prox_pts, "max": 25,
        "detail": f"{dist_km:.1f} km from sanctuary boundary → {prox_pts}/25",
    })

    # 3. Persistence in the same block (0–20).
    block = d["region"].split(" ")[0]
    recurrences = _block_recurrences(d["region"])
    pers_pts = 20 if recurrences >= 3 else 13 if recurrences == 2 else 5
    factors.append({
        "label": "Persistence in block", "points": pers_pts, "max": 20,
        "detail": f"{recurrences} detection{'s' if recurrences != 1 else ''} recorded in {block} → {pers_pts}/20",
    })

    # 4. Evidence availability (0–10).
    ev_pts = 10 if d["evidence"] else 4
    factors.append({
        "label": "Evidence availability", "points": ev_pts, "max": 10,
        "detail": ("Evidence bundle captured → 10/10" if d["evidence"]
                   else "Awaiting next pass → 4/10"),
    })

    # 5. Road-adjacency signal (0–10): active only when the road classifier runs.
    factors.append({
        "label": "Road-adjacency signal", "points": 0, "max": 10,
        "detail": "Road-feature classifier not active in this build → 0/10",
    })

    return {"score": sum(f["points"] for f in factors), "factors": factors}
