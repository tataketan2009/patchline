# PATCHLINE backend — 100% Python

The **entire backend is Python**. No JavaScript, Node, TypeScript or any
other language is used anywhere on the backend — only Python + SQLite
(Python standard library).

## Modules (all Python)

| File | Role |
|---|---|
| `main.py` | FastAPI service: state endpoints, review workflow, stats, reports, optional static hosting of `../dist` |
| `store.py` | SQLite persistence via **stdlib `sqlite3`** — detections, review workflow, alerts; seeds labelled sample data on first run |
| `scoring.py` | Explainable priority score (0–100, per-factor breakdown) — weights mirror the frontend exactly |
| `pipeline.py` | Baseline geospatial pipeline: Sentinel-2 L2A via **Earth Search STAC** → rasterio COG reads → SCL cloud mask → **NDVI differencing** (NumPy) → threshold → shapely polygonisation → area in UTM 44N (pyproj) |
| `seed_data.py` | Labelled demo dataset (Pakhal Wildlife Sanctuary sector) |
| `config.py` | Region constants, review-status enum, paths |
| `test_backend.py` | pytest suite for scoring, store, and pipeline import |

## Run

```
pip install -r requirements.txt
uvicorn main:app --reload --port 8000      # from inside backend/
python -m pytest test_backend.py -v        # run the tests
```

Because `../dist` (the built frontend) is auto-mounted when present, this
single Python process can serve **both** the API and the website.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | service status + stack info |
| GET | `/api/meta` | region, boundary, review-status enum |
| GET | `/api/detections` | filters: severity, status, region, date range, sort by priority/date |
| GET | `/api/detections/{id}` | detail + priority breakdown + review |
| PATCH | `/api/detections/{id}/review` | update review status / notes (6-stage workflow); auto-alert on escalate |
| GET | `/api/detections/{id}/report` | downloadable markdown evidence report |
| GET | `/api/detections/{id}/activity` | detection activity trail |
| GET | `/api/investigations` · POST `/api/investigations` | list (filter by detection/stage) / open an investigation |
| PATCH | `/api/investigations/{id}` · POST `…/notes` · GET `…/activity` | officer workflow: stage, officer, priority, due, progress, notes, trail |
| GET | `/api/alerts` · POST `/api/alerts` | alert feed / create with `source_ref` **dedupe** |
| POST | `/api/alerts/{id}/read` · PATCH `…/resolve` | acknowledge / resolve |
| GET | `/api/stats` | dashboard statistics (computed from the store) |
| GET | `/api/analytics` | severity/region/month distributions, completion rate |
| GET | `/api/export/detections.csv` | CSV export (filterable) |
| POST | `/api/pipeline/run` | execute the baseline change-detection pipeline over a bbox; `import_result: true` persists candidates **and auto-raises deduped alerts** |
| GET | `/api/pipeline/summary` | pipeline metadata |

## Honest scope (asserted in every response)

- Detections are **advisory candidates for human review** — a detected
  change never proves illegal activity.
- The pipeline is a clearly-labelled **classical NDVI-difference baseline**,
  not a neural network; **no confidence score is emitted** because none is
  calibrated.
- Areas are computed in **EPSG:32744 (UTM 44N)**, not raw Web-Mercator.
- The seeded demo dataset is clearly labelled as sample data.
