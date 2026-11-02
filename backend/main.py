"""
PATCHLINE FastAPI wrapper around the baseline change-detection pipeline.

Clearly-labelled baseline. Emits advisory GeoJSON candidates for human
review; never fabricates confidence scores or asserts illegality.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pipeline import run_detection, STAC_URL, COLLECTION

app = FastAPI(title="PATCHLINE baseline change-detection API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo; restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)


class BBox(BaseModel):
    minLon: float
    minLat: float
    maxLon: float
    maxLat: float
    before_from: str = Field(examples=["2025-06-01"])
    before_to: str = Field(examples=["2025-06-30"])
    after_from: str = Field(examples=["2025-10-01"])
    after_to: str = Field(examples=["2025-10-31"])
    max_cloud: float = 20.0


@app.get("/health")
def health():
    return {
        "status": "ok",
        "pipeline": "baseline-ndvi-difference (not a neural network)",
        "source": {"stac": STAC_URL, "collection": COLLECTION},
        "note": "Advisory output for human review; no fabricated confidence.",
    }


@app.post("/detect")
def detect(b: BBox):
    try:
        result = run_detection(
            (b.minLon, b.minLat, b.maxLon, b.maxLat),
            b.before_from, b.before_to, b.after_from, b.after_to,
            b.max_cloud,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result
