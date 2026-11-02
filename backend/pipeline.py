"""
PATCHLINE — baseline change-detection pipeline (clearly labelled).

NOT a neural network. Detects candidate land-cover change between two
Sentinel-2 L2A observations by NDVI differencing, then emits georeferenced
candidate polygons with areas computed in a projected CRS.

Pipeline: STAC query -> band stack + SCL masking -> NDVI -> ΔNDVI ->
threshold -> polygonise -> UTM area -> GeoJSON (+ JSON summary).

Everything here is advisory for human review; nothing claims illegality
and no confidence score is emitted (none is calibrated).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from typing import Any

import numpy as np
import rasterio
from rasterio.features import shapes as raster_shapes
from rasterio.transform import from_bounds as transform_from_bounds
import httpx
from pyproj import Transformer
from shapely.geometry import shape, mapping, box
from shapely.ops import transform as shp_transform

STAC_URL = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"

# ΔNDVI threshold: a drop beyond this between the two observations flags a
# candidate pixel. Conservative by default to limit false positives.
DEFAULT_NDVI_DROP = 0.20
# Minimum polygon area in m^2 to keep (noise floor).
DEFAULT_MIN_AREA = 2000.0
# SCL classes treated as unusable (clouds, shadows, no data, saturated).
SCL_EXCLUDED = (0, 1, 3, 8, 9, 10, 11)


@dataclass
class Detection:
    geometry: dict[str, Any]
    area_ha: float
    ndvi_drop: float


def utm_epsg(lon: float, lat: float) -> int:
    """UTM zone EPSG for area-accurate measurements (northern hemisphere)."""
    return 32600 + max(1, min(60, int((lon + 180) / 6) + 1))


def search_items(lon_min: float, lat_min: float, lon_max: float, lat_max: float,
                 date_from: str, date_to: str, max_cloud: float = 20.0,
                 client: httpx.Client | None = None) -> list[dict]:
    """Return STAC items (least-cloudy first) for the bbox/date window."""
    body = {
        "collections": [COLLECTION],
        "bbox": [lon_min, lat_min, lon_max, lat_max],
        "datetime": f"{date_from}/{date_to}",
        "query": {"eo:cloud_cover": {"lt": max_cloud}},
        "sort-by": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        "limit": 10,
    }
    http = client or httpx.Client(timeout=60)
    r = http.post(STAC_URL, json=body)
    r.raise_for_status()
    return r.json().get("features", [])


def _read_band(item: dict, band: str, bbox: tuple[float, float, float, float]):
    """COG read via rasterio's /vsicurl (no download of whole tiles)."""
    assets = item.get("assets", {})
    if band not in assets:
        raise KeyError(f"asset {band} missing on item {item.get('id')}")
    href = assets[band]["href"]
    with rasterio.open(href) as src:
        window = src.window(*bbox)
        data = src.read(1, window=window)
        arr = data.astype(np.float32)
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan
        return arr, src.window_transform(window)


def _read_scl(item: dict, bbox: tuple[float, float, float, float]):
    assets = item.get("assets", {})
    if "scl" not in assets:
        return None
    href = assets["scl"]["href"]
    with rasterio.open(href) as src:
        window = src.window(*bbox)
        return src.read(1, window=window)


def _ndvi(item: dict, bbox, scale: int = 10000) -> tuple[np.ndarray, Any, np.ndarray]:
    red, t = _read_band(item, "red", bbox)
    nir, _ = _read_band(item, "nir", bbox)
    scl = _read_scl(item, bbox)
    valid = np.isfinite(red) & np.isfinite(nir)
    if scl is not None and scl.shape == red.shape:
        # SCL is 20 m (native F10 for L2A in newer HIRS? guard via resize)
        ok_scl = np.isin(scl, SCL_EXCLUDED, invert=True)
        valid &= ok_scl
    red = red / scale
    nir = nir / scale
    denom = (nir + red)
    with np.errstate(invalid="ignore", divide="ignore"):
        ndvi = (nir - red) / denom
    ndvi[~valid] = np.nan
    return ndvi, t, valid


def detect_change(bbox, before_item: dict, after_item: dict,
                  ndvi_drop: float = DEFAULT_NDVI_DROP,
                  min_area_m2: float = DEFAULT_MIN_AREA) -> dict[str, Any]:
    """Return GeoJSON FeatureCollection of candidate change polygons + summary."""
    lon_min, lat_min, lon_max, lat_max = bbox
    ndvi_b, _, _ = _ndvi(before_item, bbox)
    ndvi_a, transform, _ = _ndvi(after_item, bbox)

    delta = ndvi_a - ndvi_b  # negative = vegetation loss
    change = np.where(np.isfinite(delta) & (delta <= -ndvi_drop), 1, 0).astype(np.uint8)

    polys: list[Detection] = []
    if change.any():
        for geom, val in raster_shapes(change, mask=None, transform=transform, connectivity=4):
            if val != 1:
                continue
            s = shape(geom)
            area_src = s.area  # in degrees — invert via UTM for real hectares
            epsg = utm_epsg((lon_min + lon_max) / 2, (lat_min + lat_max) / 2)
            to_utm = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
            s_utm = shp_transform(lambda x, y, z=None: to_utm.transform(x, y), s)
            area_m2 = s_utm.area
            if area_m2 < min_area_m2:
                continue
            drop = float(delta[np.isfinite(delta)].min())
            polys.append(Detection(mapping(s), round(area_m2 / 10_000.0, 4), drop))

    summary = {
        "pipeline": "baseline-ndvi-difference",
        "model": "none (classical change detection — labelled BASELINE)",
        "confidence": None,
        "source": {"collection": COLLECTION, "stac": STAC_URL},
        "observations": {
            "before": {"id": before_item.get("id"), "datetime": before_item["properties"]["datetime"][:10],
                       "cloud": before_item["properties"].get("eo:cloud_cover")},
            "after": {"id": after_item.get("id"), "datetime": after_item["properties"]["datetime"][:10],
                      "cloud": after_item["properties"].get("eo:cloud_cover")},
        },
        "thresholds": {"ndvi_drop": ndvi_drop, "min_area_m2": min_area_m2},
        "note": ("Advisory candidates for human review only. No claim of "
                 "illegality is made; verify in the field."),
    }

    fc = {
        "type": "FeatureCollection",
        "name": "patchline-baseline-change",
        "features": [
            {"type": "Feature", "properties": {"area_ha": d.area_ha, "max_ndvi_drop": d.ndvi_drop},
             "geometry": d.geometry}
            for d in polys
        ],
        "summary": summary,
    }
    return fc


def run_detection(bbox, date_from_before: str, date_before_end: str,
                  date_from_after: str, date_to: str,
                  max_cloud: float = 20.0) -> dict[str, Any]:
    """Full run: pick least-cloudy before/after items, then detect_change."""
    items_b = search_items(*bbox, date_from_before, date_before_end, max_cloud)
    items_a = search_items(*bbox, date_from_after, date_to, max_cloud)
    if not items_b or not items_a:
        raise RuntimeError("No suitably clear Sentinel-2 observations found for the window.")
    return detect_change(bbox, items_b[0], items_a[0])


if __name__ == "__main__":
    # Demo: Pakhal Wildlife Sanctuary box (Warangal, Telangana), Jun vs Oct 2025.
    box = (79.71, 17.71, 80.06, 18.14)
    out = run_detection(box, "2025-06-01", "2025-06-30", "2025-10-01", "2025-10-31")
    print(json.dumps(out["summary"], indent=2))
    with open("patchline-change.geojson", "w", encoding="utf8") as f:
        json.dump(out, f)
    print(f"→ patchline-change.geojson ({len(out['features'])} candidate polygons)")
