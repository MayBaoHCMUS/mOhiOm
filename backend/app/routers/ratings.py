"""API routes for user ratings and feedback collection."""

from datetime import datetime, timezone
from fastapi import APIRouter, Header
from typing import Optional, Dict
from pydantic import BaseModel
from app.database import mongo_db

router = APIRouter(prefix="/ratings", tags=["ratings"])


def _panel_col():
    return mongo_db.get_database()["panel_ratings"]


def _comic_col():
    return mongo_db.get_database()["comic_ratings"]


class PanelRatingRequest(BaseModel):
    panel_id: str
    comic_id: str
    reaction: str  # "love" | "good" | "neutral" | "bad"
    panel_version: int = 1
    was_regenerated: bool = False
    regen_count: int = 0


class ComicRatingRequest(BaseModel):
    comic_id: str
    stars: Optional[int] = None
    skipped: bool = False
    comment_positive: str = ""
    comment_negative: str = ""
    total_panels: int = 0
    panels_regenerated: int = 0
    total_regen_count: int = 0
    art_style: str = ""
    genre: str = ""
    total_session_time_seconds: int = 0
    panel_reactions_summary: Dict[str, int] = {}
    step_completion_times: Dict[str, int] = {}


@router.post("/panel")
def rate_panel(
    payload: PanelRatingRequest,
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    doc = {
        **payload.model_dump(),
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _panel_col().update_one(
        {"user_id": user_id, "comic_id": payload.comic_id, "panel_id": payload.panel_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@router.get("/panels/{comic_id}")
def get_panel_ratings(
    comic_id: str,
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    docs = list(_panel_col().find(
        {"user_id": user_id, "comic_id": comic_id},
        {"_id": 0},
    ))
    return {"ratings": docs}


@router.post("/comic")
def rate_comic(
    payload: ComicRatingRequest,
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    doc = {
        **payload.model_dump(),
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _comic_col().update_one(
        {"user_id": user_id, "comic_id": payload.comic_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@router.get("/comic/{comic_id}")
def get_comic_rating(
    comic_id: str,
    x_user_id: Optional[str] = Header(None),
):
    user_id = x_user_id or "anonymous"
    doc = _comic_col().find_one(
        {"user_id": user_id, "comic_id": comic_id},
        {"_id": 0},
    )
    return {"rating": doc}
