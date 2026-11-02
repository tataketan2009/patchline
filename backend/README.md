# PATCHLINE baseline pipeline — backend service (separate from the static site)

This is a **clearly-labelled baseline change-detection pipeline**, not a
pretence of a neural network. It is intended to run on a workstation or
in Colab; the deployed site remains static.

## What it does (honest scope)

1. Queries two Sentinel-2 L2A observations over a bbox via the
   **Earth Search STAC API** (AWS Open Data, no credentials needed for
   read-only queries).
2. Spatially aligns red (B04) + NIR (B08) bands on a common grid.
3. Applies the SCL cloud/shadow/vegetation mask from item metadata.
4. Computes **NDVI** per observation and the **ΔNDVI** difference.
5. Thresholds ΔNDVI to produce candidate change footprints.
6. Vectorises footprints into polygons (rasterio → shapely).
7. Areas are computed in **EPSG:32744** (UTM 44N — correct for Telangana),
   not raw Web-Mercator degrees.
8. Result is a GeoJSON FeatureCollection + JSON summary. Nothing is
   fabricated: no confidence score is emitted (none is calibrated), and
   polygons are advisory candidates for **human review only**.

## API (FastAPI)

```
uvicorn main:app --reload --port 8000
```

| Endpoint | Purpose |
|---|---|
| `GET /health` | service + configured source info |
| `POST /detect` | `{minLon,minLat,maxLon,maxLat, before:"2026-06-12", after:"2026-10-28", max_cloud=20}` → GeoJSON + summary |

The frontend's **Import GeoJSON** button consumes this output directly —
that is the wiring: pipeline → GeoJSON → PATCHLINE map.

## Honest limitations (say these to judges)

- Sentinel-2 revisit is ~5 days; cloud cover in monsoon Telangana limits pairs.
- ΔNDVI thresholding is the classic baseline; it flags **change**, not
  *illegal* change — legal/illegal is a human, field-verified determination
  (see Hansen/GFW for reference layers, also advisory).
- Ready-for-upgrade path: swap `pipeline.baseline_ndvi_diff` for a Siamese
  U-Net (PyTorch) once curated training pairs exist; geometry + area code
  stays identical.
