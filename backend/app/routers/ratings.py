"""API routes for user ratings and feedback collection."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from typing import Any, Optional, Dict, List
from pydantic import BaseModel
from app.database import mongo_db
from app.deps import get_current_user_required

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
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
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
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    docs = list(_panel_col().find(
        {"user_id": user_id, "comic_id": comic_id},
        {"_id": 0},
    ))
    return {"ratings": docs}


@router.post("/comic")
def rate_comic(
    payload: ComicRatingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
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
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    doc = _comic_col().find_one(
        {"user_id": user_id, "comic_id": comic_id},
        {"_id": 0},
    )
    return {"rating": doc}


# ─── Character ratings ────────────────────────────────────────────────────────

def _char_col():
    return mongo_db.get_database()["character_ratings"]


def _char_set_col():
    return mongo_db.get_database()["character_set_ratings"]


class CharacterRatingRequest(BaseModel):
    character_id: str
    comic_id: str
    version: int
    reaction: str  # "love" | "good" | "neutral" | "bad"
    chips_selected: List[str] = []
    feedback_text: str = ""


class CharacterSetRatingRequest(BaseModel):
    comic_id: str
    stars: Optional[int] = None
    comment: str = ""
    total_characters: int = 0
    characters_regenerated: int = 0
    avg_versions_per_character: float = 0.0
    character_reactions: Dict[str, Dict] = {}
    time_spent_seconds: int = 0


@router.post("/character")
def rate_character(
    payload: CharacterRatingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    doc = {
        **payload.model_dump(),
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _char_col().update_one(
        {"user_id": user_id, "comic_id": payload.comic_id, "character_id": payload.character_id, "version": payload.version},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@router.get("/characters/{comic_id}")
def get_character_ratings(
    comic_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    docs = list(_char_col().find({"user_id": user_id, "comic_id": comic_id}, {"_id": 0}))
    return {"ratings": docs}


@router.post("/character-set")
def rate_character_set(
    payload: CharacterSetRatingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    doc = {
        **payload.model_dump(),
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _char_set_col().update_one(
        {"user_id": user_id, "comic_id": payload.comic_id},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@router.get("/character-set/{comic_id}")
def get_character_set_rating(
    comic_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
):
    user_id = str(current_user["_id"])
    doc = _char_set_col().find_one({"user_id": user_id, "comic_id": comic_id}, {"_id": 0})
    return {"rating": doc}
