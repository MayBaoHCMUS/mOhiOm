"""
Public gallery API — community characters and comics (no auth required).
"""

from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from app.schemas import CharacterSummary, GalleryComicSummary, GalleryComicDetail
from app.database import mongo_db

router = APIRouter(prefix="/gallery", tags=["gallery"])


def _char_col():
    return mongo_db.get_database()["user_characters"]


def _proj_col():
    return mongo_db.get_database()["projects"]


def _first_success_page_url(steps: Dict[str, Any]) -> str | None:
    page_states = (((steps.get("step4") or {}).get("data") or {}).get("pageStates") or {})
    for key in sorted(page_states.keys()):
        state = page_states[key]
        if state.get("status") == "success" and state.get("imageUrl"):
            return state["imageUrl"]
    return None


def _success_pages(steps: Dict[str, Any]) -> List[Dict[str, Any]]:
    page_states = (((steps.get("step4") or {}).get("data") or {}).get("pageStates") or {})
    pages = []
    for key in sorted(page_states.keys()):
        state = page_states[key]
        if state.get("status") == "success" and state.get("imageUrl"):
            try:
                page_number = int(key.replace("page-", ""))
            except ValueError:
                page_number = 0
            pages.append({"page_number": page_number, "image_url": state["imageUrl"]})
    return pages


def _title_from_story(story: str) -> str:
    if not story:
        return "Untitled"
    first_line = story.strip().split("\n")[0].strip()
    return first_line[:80] if first_line else "Untitled"


@router.get("/characters", response_model=List[CharacterSummary])
def list_public_characters() -> List[CharacterSummary]:
    """Return all characters that users have opted to share publicly."""
    chars = list(_char_col().find({"is_public": True}, {"_id": 0}))
    return [
        CharacterSummary(
            character_id=c.get("character_id", ""),
            name=c.get("name", ""),
            prompt=c.get("prompt") or None,
            selected_image_url=c.get("selected_image_url") or None,
            project_id=c.get("project_id") or None,
            is_public=True,
        )
        for c in chars
        if c.get("character_id")
    ]


@router.get("/comics", response_model=List[GalleryComicSummary])
def list_public_comics() -> List[GalleryComicSummary]:
    """Return published comics that have at least one generated page image."""
    docs = list(_proj_col().find({"is_public": True}, {"_id": 0, "user_id": 0}))
    result = []
    for doc in docs:
        steps = doc.get("steps") or {}
        cover_url = _first_success_page_url(steps)
        if not cover_url:
            continue
        pages = _success_pages(steps)
        user_inputs = doc.get("user_inputs") or {}
        story = user_inputs.get("story_content") or user_inputs.get("storyText") or ""
        result.append(GalleryComicSummary(
            project_id=doc.get("project_id", ""),
            title=_title_from_story(story),
            genre=user_inputs.get("manga_genre") or user_inputs.get("genre") or "",
            art_style=user_inputs.get("art_style") or "",
            story_synopsis=story[:300],
            cover_image_url=cover_url,
            page_count=len(pages),
            published_at=doc.get("saved_at", ""),
        ))
    return sorted(result, key=lambda x: x.published_at, reverse=True)


@router.get("/comics/{project_id}", response_model=GalleryComicDetail)
def get_public_comic(project_id: str) -> GalleryComicDetail:
    """Return full detail for a published comic (for the reader)."""
    doc = _proj_col().find_one({"project_id": project_id, "is_public": True}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Comic not found or not public")
    steps = doc.get("steps") or {}
    pages = _success_pages(steps)
    user_inputs = doc.get("user_inputs") or {}
    story = user_inputs.get("story_content") or user_inputs.get("storyText") or ""
    return GalleryComicDetail(
        project_id=doc.get("project_id", ""),
        title=_title_from_story(story),
        genre=user_inputs.get("manga_genre") or user_inputs.get("genre") or "",
        art_style=user_inputs.get("art_style") or "",
        story_content=story,
        main_characters=user_inputs.get("main_characters") or user_inputs.get("mainCharacters") or "",
        pages=pages,
    )
