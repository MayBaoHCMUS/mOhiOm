"""API routes for panel bubble data persistence."""

from fastapi import APIRouter, Header, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.database import mongo_db

router = APIRouter(prefix="/bubbles", tags=["bubbles"])


def _col():
    return mongo_db.get_database()["panel_bubbles"]


class BubbleData(BaseModel):
    id: str
    dialogue: Optional[str] = None
    bubbleType: str
    tailDir: str
    bubblePosition: Dict[str, float]  # {x: float, y: float}
    bubbleSize: Dict[str, float]      # {w: float, h: float}
    fontSize: float
    rotation: float
    opacity: Optional[float] = 1.0
    fillColor: Optional[str] = None
    textColor: Optional[str] = None
    character: Optional[str] = None
    zIndex: int
    crossPanel: Optional[bool] = False


class PanelBubblesUpsert(BaseModel):
    panelId: str
    comicId: str
    bubbles: List[BubbleData]


@router.get("")
def get_bubbles_for_comic(
    comicId: str = Query(...),
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    docs = list(_col().find({"comicId": comicId, "userId": user_id}, {"_id": 0}))
    return docs


@router.put("/{panel_id}")
def upsert_panel_bubbles(
    panel_id: str,
    payload: PanelBubblesUpsert,
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    doc = {
        "panelId": panel_id,
        "comicId": payload.comicId,
        "userId": user_id,
        "bubbles": [b.model_dump() for b in payload.bubbles],
    }
    _col().update_one(
        {"panelId": panel_id, "comicId": payload.comicId, "userId": user_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "panelId": panel_id}


@router.delete("/{panel_id}")
def delete_panel_bubbles(
    panel_id: str,
    comicId: str = Query(...),
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    _col().delete_one({"panelId": panel_id, "comicId": comicId, "userId": user_id})
    return {"ok": True, "panelId": panel_id}
