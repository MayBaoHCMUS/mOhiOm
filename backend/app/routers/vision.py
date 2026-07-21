"""API routes for computer-vision utilities (currently: anime face detection)."""

import os
from typing import Any, Dict, List, Optional

import cv2
import httpx
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user_required

router = APIRouter(prefix="/vision", tags=["vision"])

_CASCADE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "lbpcascade_animeface.xml")
_cascade: Optional[cv2.CascadeClassifier] = None


def _get_cascade() -> cv2.CascadeClassifier:
    """Lazily load and cache the anime-face Haar cascade (loaded once per process)."""
    global _cascade
    if _cascade is None:
        clf = cv2.CascadeClassifier(_CASCADE_PATH)
        if clf.empty():
            raise RuntimeError(f"Failed to load anime face cascade from {_CASCADE_PATH}")
        _cascade = clf
    return _cascade


class FaceBox(BaseModel):
    x: float  # normalized 0-1, left edge
    y: float  # normalized 0-1, top edge
    w: float  # normalized 0-1, width
    h: float  # normalized 0-1, height


class DetectFacesRequest(BaseModel):
    image_url: str


class DetectFacesResponse(BaseModel):
    faces: List[FaceBox]


@router.post("/detect-faces", response_model=DetectFacesResponse)
async def detect_faces(
    payload: DetectFacesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
) -> DetectFacesResponse:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(payload.image_url)
            resp.raise_for_status()
            image_bytes = resp.content
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch panel image: {e}")

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    gray = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if gray is None:
        raise HTTPException(status_code=422, detail="Could not decode image")

    height, width = gray.shape[:2]
    gray = cv2.equalizeHist(gray)

    try:
        cascade = _get_cascade()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    min_dim = int(min(width, height) * 0.05) or 1
    detections = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(min_dim, min_dim),
    )

    faces = [
        FaceBox(x=x / width, y=y / height, w=w / width, h=h / height)
        for (x, y, w, h) in detections
    ]
    return DetectFacesResponse(faces=faces)
