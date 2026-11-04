"""PATCHLINE persistence — SQLite (Python standard library only).

All application state (detections, review workflow, alerts) lives in a
single-file SQLite database seeded on first run from the labelled sample
dataset. No other database engine or service is required.
"""

from __future__ import annotations

import sqlite3
import threading
from typing import Any

from config import DB_PATH, REVIEW_STATUSES
from seed_data import (
    SEED_ALERTS,
    SEED_DETECTIONS,
    SEED_INVESTIGATIONS,
)

_lock = threading.Lock()

INVESTIGATION_STAGES = (
    "new",
    "assigned",
    "investigating",
    "pending-verification",
    "resolved",
    "closed",
)

PRIORITIES = ("low", "medium", "high", "critical")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    """Additive, idempotent schema migrations (safe on existing DBs)."""
    for stmt in (
        "ALTER TABLE alerts ADD COLUMN status TEXT NOT NULL DEFAULT 'open'",
        "ALTER TABLE alerts ADD COLUMN source_ref TEXT",
        "ALTER TABLE alerts ADD COLUMN detection_id TEXT",
        """
        CREATE TABLE IF NOT EXISTS investigations (
            id           TEXT PRIMARY KEY,
            detection_id TEXT NOT NULL REFERENCES detections(id),
            officer      TEXT NOT NULL DEFAULT 'Unassigned',
            stage        TEXT NOT NULL CHECK (stage IN ('new','assigned','investigating','pending-verification','resolved','closed')),
            priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
            due          TEXT NOT NULL DEFAULT '',
            progress     INTEGER NOT NULL DEFAULT 0,
            created      TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS activity_log (
            ts        TEXT NOT NULL DEFAULT (datetime('now')),
            ref_type  TEXT NOT NULL,               -- 'detection' | 'investigation'
            ref_id    TEXT NOT NULL,
            actor     TEXT NOT NULL,
            text      TEXT NOT NULL
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_det_region ON detections(region)",
        "CREATE INDEX IF NOT EXISTS idx_det_date ON detections(date)",
        "CREATE INDEX IF NOT EXISTS idx_inv_det ON investigations(detection_id)",
    ):
        try:
            conn.execute(stmt)
        except sqlite3.OperationalError:
            pass  # column/index already exists


def init_db() -> None:
    """Create tables and seed the labelled demo dataset on first run."""
    with _lock, _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS detections (
                id        TEXT PRIMARY KEY,
                date      TEXT NOT NULL,
                region    TEXT NOT NULL,
                area_ha   REAL NOT NULL,
                lat       REAL NOT NULL,
                lon       REAL NOT NULL,
                severity  TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
                status    TEXT NOT NULL CHECK (status IN ('new','investigating','resolved')),
                evidence  INTEGER NOT NULL,
                polygon   TEXT NOT NULL,          -- JSON [[lat, lon], ...]
                source    TEXT NOT NULL DEFAULT 'sample-seed'
            );

            CREATE TABLE IF NOT EXISTS reviews (
                detection_id TEXT PRIMARY KEY REFERENCES detections(id),
                status  TEXT NOT NULL DEFAULT 'new',
                notes   TEXT NOT NULL DEFAULT '',
                updated TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id       TEXT PRIMARY KEY,
                severity TEXT NOT NULL,
                title    TEXT NOT NULL,
                region   TEXT NOT NULL,
                time     TEXT NOT NULL,
                read     INTEGER NOT NULL DEFAULT 0
            );
            """
        )

        _migrate(conn)

        if not conn.execute("SELECT 1 FROM detections LIMIT 1").fetchone():
            cols = "id, date, region, area_ha, lat, lon, severity, status, evidence, polygon, source"
            for d in SEED_DETECTIONS:
                conn.execute(
                    f"INSERT INTO detections ({cols}) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (
                        d["id"], d["date"], d["region"], d["area_ha"], d["lat"],
                        d["lon"], d["severity"], d["status"], int(d["evidence"]),
                        _json_polygon(d["polygon"]), "sample-seed"),
                )
            for d in SEED_DETECTIONS:
                conn.execute("INSERT INTO reviews (detection_id) VALUES (?)", (d["id"],))
        if not conn.execute("SELECT 1 FROM alerts LIMIT 1").fetchone():
            for a in SEED_ALERTS:
                conn.execute(
                    "INSERT INTO alerts VALUES (?,?,?,?,?,?)",
                    (a["id"], a["severity"], a["title"], a["region"], a["time"], int(a["read"])),
                )

        if not conn.execute("SELECT 1 FROM investigations LIMIT 1").fetchone():
            # Demo seed mapped to the canonical stage vocabulary.
            stage_map = {"triage": "new", "field-verification": "investigating",
                         "evidence-review": "investigating", "enforcement": "pending-verification"}
            for inv in SEED_INVESTIGATIONS:
                conn.execute(
                    "INSERT INTO investigations (id, detection_id, officer, stage, priority, due, progress)"
                    " VALUES (?,?,?,?,?,?,?)",
                    (inv["id"], inv["detectionId"], inv["officer"], stage_map.get(inv["stage"], "new"),
                     "high" if inv["progress"] >= 70 else "medium", inv["due"], inv["progress"]),
                )
                conn.execute(
                    "INSERT INTO activity_log (ref_type, ref_id, actor, text) VALUES ('investigation', ?, 'System', ?)",
                    (inv["id"], f"Investigation {inv['id']} seeded from demo data (stage: {inv['stage']})."),
                )


def _json_polygon(poly: list[list[float]]) -> str:
    import json
    return json.dumps(poly)


# ---------------------------------------------------------------- queries ---

def list_detections(
    severity: str | None = None,
    status: str | None = None,
    region_prefix: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM detections WHERE 1=1"
    params: list[Any] = []
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    if status:
        sql += " AND status = ?"
        params.append(status)
    if region_prefix:
        sql += " AND region LIKE ?"
        params.append(f"{region_prefix}%")
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)
    sql += " ORDER BY date DESC"
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params)]
    for r in rows:
        r["evidence"] = bool(r["evidence"])
        r["polygon"] = json_loads(r["polygon"])
    return rows


def get_detection(det_id: str) -> dict[str, Any] | None:
    rows = [d for d in list_detections() if d["id"] == det_id]
    return rows[0] if rows else None


def next_detection_id() -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM detections WHERE id LIKE 'PL-%' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    year = "2026"
    seq = 798  # floor for synthesis: seed max
    if row and len(row["id"].split("-")) == 3:
        year, seq = row["id"].split("-")[1], int(row["id"].split("-")[2])
    return f"PL-{year}-{seq + 1:04d}"


def insert_detection(d: dict[str, Any]) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO detections
               (id, date, region, area_ha, lat, lon, severity, status, evidence, polygon, source)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                d["id"], d["date"], d["region"], d["area_ha"], d["lat"], d["lon"],
                d["severity"], d["status"], int(d["evidence"]),
                _json_polygon(d["polygon"]), d.get("source", "pipeline-import"),
            ),
        )
        conn.execute("INSERT OR IGNORE INTO reviews (detection_id) VALUES (?)", (d["id"],))


def get_review(det_id: str) -> dict[str, Any]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM reviews WHERE detection_id = ?", (det_id,)).fetchone()
    return dict(row) if row else {"detection_id": det_id, "status": "new", "notes": "", "updated": ""}


def set_review(det_id: str, status: str | None, notes: str | None) -> dict[str, Any]:
    current = get_review(det_id)
    status = status if status is not None else current["status"]
    if status not in REVIEW_STATUSES:
        raise ValueError(f"Unknown review status: {status}")
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO reviews (detection_id, status, notes, updated)
               VALUES (?,?,?,datetime('now'))
               ON CONFLICT(detection_id) DO UPDATE SET
                 status = excluded.status,
                 notes = excluded.notes,
                 updated = excluded.updated""",
            (det_id, status, notes if notes is not None else current["notes"]),
        )
    return get_review(det_id)


def list_alerts(severity: str | None = None, only_unread: bool = False) -> list[dict[str, Any]]:
    sql = "SELECT * FROM alerts WHERE 1=1"
    params: list[Any] = []
    if severity:
        sql += " AND severity = ?"
        params.append(severity)
    if only_unread:
        sql += " AND read = 0"
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(sql, params)]
    for r in rows:
        r["read"] = bool(r["read"])
    return rows


def mark_alert_read(alert_id: str, read: bool) -> None:
    with _lock, _connect() as conn:
        conn.execute("UPDATE alerts SET read = ? WHERE id = ?", (int(read), alert_id))


def json_loads(s: str) -> Any:
    import json
    return json.loads(s)


# ------------------------------------------------------------- investigations ---

INV_STAGE_MAP = {"triage": "new", "field-verification": "investigating",
                 "evidence-review": "investigating", "enforcement": "pending-verification"}


def list_investigations(detection_id: str | None = None, stage: str | None = None) -> list[dict[str, Any]]:
    sql = "SELECT * FROM investigations WHERE 1=1"
    params: list[Any] = []
    if detection_id:
        sql += " AND detection_id = ?"
        params.append(detection_id)
    if stage:
        sql += " AND stage = ?"
        params.append(stage)
    with _connect() as conn:
        rows = [dict(r) for r in conn.execute(sql + " ORDER BY id DESC", params)]
    return rows


def get_investigation(inv_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM investigations WHERE id = ?", (inv_id,)).fetchone()
    return dict(row) if row else None


def next_investigation_id() -> str:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM investigations WHERE id LIKE 'INV-%' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    seq = int(row["id"].split("-")[1]) if row else 100
    return f"INV-{seq + 1:03d}"


def insert_investigation(detection_id: str, officer: str, stage: str,
                         priority: str, due: str, progress: int) -> str:
    inv_id = next_investigation_id()
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO investigations (id, detection_id, officer, stage, priority, due, progress)"
            " VALUES (?,?,?,?,?,?,?)",
            (inv_id, detection_id, officer, stage, priority, due, progress),
        )
        conn.execute(
            "INSERT INTO activity_log (ref_type, ref_id, actor, text) VALUES ('investigation', ?, 'System', ?)",
            (inv_id, f"Investigation opened for detection {detection_id}"),
        )
    return inv_id


def update_investigation(inv_id: str, patch: dict[str, Any], actor: str = "Analyst") -> dict[str, Any]:
    allowed = {"officer", "stage", "priority", "due", "progress"}
    sets, params, texts = [], [], []
    for k, v in patch.items():
        if k not in allowed or v is None:
            continue
        if k == "stage" and v not in INVESTIGATION_STAGES:
            raise ValueError(f"Unknown investigation stage: {v}")
        sets.append(f"{k} = ?")
        params.append(v)
        texts.append(f"{k} set to {v}")
    if sets:
        with _lock, _connect() as conn:
            conn.execute(f"UPDATE investigations SET {', '.join(sets)} WHERE id = ?", (*params, inv_id))
            if texts:
                conn.execute(
                    "INSERT INTO activity_log (ref_type, ref_id, actor, text) VALUES ('investigation', ?, ?, ?)",
                    (inv_id, actor, "; ".join(texts)),
                )
    return get_investigation(inv_id)


# ------------------------------------------------------------------- alerts ---

def next_alert_id() -> str:
    with _connect() as conn:
        row = conn.execute("SELECT id FROM alerts WHERE id LIKE 'AL-%' ORDER BY id DESC LIMIT 1").fetchone()
    seq = int(row["id"].split("-")[1]) if row else 400
    return f"AL-{seq + 1:03d}"


def insert_alert(severity: str, title: str, region: str, time: str,
                 source_ref: str | None = None, detection_id: str | None = None) -> tuple[str, bool]:
    """Create an alert; dedupes on source_ref so one processing event never
    produces repeat alerts. Returns (id, created)."""
    if source_ref:
        with _connect() as conn:
            row = conn.execute("SELECT id FROM alerts WHERE source_ref = ?", (source_ref,)).fetchone()
        if row:
            return row["id"], False
    alert_id = next_alert_id()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO alerts (id, severity, title, region, time, read, status, source_ref, detection_id)
               VALUES (?,?,?,?,?,0,'open',?,?)""",
            (alert_id, severity, title, region, time, source_ref, detection_id),
        )
    return alert_id, True


def mark_alert_resolved(alert_id: str) -> None:
    with _lock, _connect() as conn:
        conn.execute("UPDATE alerts SET status = 'resolved', read = 1 WHERE id = ?", (alert_id,))


# ------------------------------------------------------------------ activity --

def add_activity(ref_type: str, ref_id: str, actor: str, text: str) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO activity_log (ref_type, ref_id, actor, text) VALUES (?,?,?,?)",
            (ref_type, ref_id, actor, text),
        )


def list_activity(ref_type: str, ref_id: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT ts, ref_type, ref_id, actor, text FROM activity_log"
            " WHERE ref_type = ? AND ref_id = ? ORDER BY ts DESC",
            (ref_type, ref_id),
        ).fetchall()
    return [dict(r) for r in rows]


# ----------------------------------------------------------------- analytics --

def analytics() -> dict[str, Any]:
    ds = list_detections()
    invs = list_investigations()
    by_sev: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_region: dict[str, float] = {}
    by_month: dict[str, int] = {}
    by_block: dict[str, int] = {}
    for d in ds:
        by_sev[d["severity"]] += 1
        by_region[d["region"]] = round(by_region.get(d["region"], 0.0) + d["area_ha"], 1)
        by_month[d["date"][:7]] = by_month.get(d["date"][:7], 0) + 1
        blk = d["region"].split(" ")[0]
        by_block[blk] = by_block.get(blk, 0) + 1
    resolved_inv = sum(1 for i in invs if i["stage"] in ("resolved", "closed"))
    return {
        "totalDetections": len(ds),
        "totalAffectedHa": round(sum(d["area_ha"] for d in ds), 1),
        "severityDistribution": by_sev,
        "regionAffectedHa": [{"region": k, "area_ha": v} for k, v in sorted(by_region.items(), key=lambda x: -x[1])],
        "detectionsByMonth": [{"month": k, "count": v} for k, v in sorted(by_month.items())],
        "detectionsByBlock": [{"block": k, "count": v} for k, v in sorted(by_block.items(), key=lambda x: -x[1])],
        "investigationCompletionRate": round(100 * resolved_inv / len(invs), 1) if invs else None,
        "totalInvestigations": len(invs),
    }
