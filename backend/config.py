"""PATCHLINE backend — shared configuration.

Pure Python. No JavaScript/Node is involved anywhere in the backend.
"""

from __future__ import annotations

from pathlib import Path

# Demo region: Pakhal Wildlife Sanctuary, Warangal district, Telangana, India.
REGION = {
    "name": "Pakhal PS-1",
    "subregion": "Pakhal Wildlife Sanctuary · Warangal, Telangana",
    "center": [17.95, 79.88],
    "monitoredKm2": 879,
}

REGION_BOUNDARY = [
    [17.78, 80.02],
    [17.78, 79.74],
    [17.92, 79.71],
    [18.08, 79.72],
    [18.14, 79.82],
    [18.12, 79.98],
    [18.02, 80.05],
    [17.9, 80.06],
]

REVIEW_STATUSES = [
    "new",
    "under-review",
    "verified",
    "false-positive",
    "escalated",
    "resolved",
]

REVIEW_LABELS = {
    "new": "New",
    "under-review": "Under review",
    "verified": "Verified change",
    "false-positive": "False positive",
    "escalated": "Escalated",
    "resolved": "Resolved",
}

DEMO_NOTE = (
    "Sample data for the Pakhal sector, clearly labelled in the UI. "
    "Detections are advisory candidates for human review — a detection "
    "never proves illegal activity."
)

# SQLite database lives next to the backend code.
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "patchline.db"

# Built frontend (if present) is served by this Python process too, so the
# entire running application can be a single Python service.
DIST_DIR = BASE_DIR.parent / "dist"
