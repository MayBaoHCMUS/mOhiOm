"""
Public gallery API — community characters and comics (no auth required).
"""

import re
from fastapi import APIRouter, HTTPException, Query
from typing import Any, Dict, List
from app.schemas import CharacterSummary, GalleryComicSummary, GalleryComicDetail
from app.database import mongo_db

router = APIRouter(prefix="/gallery", tags=["gallery"])

_PANEL_ID_RE = re.compile(r"^panel:p(\d+)-n(\d+)$")


def _char_col():
    return mongo_db.get_database()["user_characters"]


def _proj_col():
    return mongo_db.get_database()["projects"]


def _img_col():
    return mongo_db.get_database()["project_images"]


def _project_images_pages(project_id: str) -> List[Dict[str, Any]]:
    """Real image data lives in project_images (saved via POST /{project_id}/images),
    not step4.data.pageStates — the current app never populates the latter. Prefer
    full composed page images; fall back to one "page" per panel image (unassembled,
    but still real content) when only panel-level images were saved."""
    docs = list(_img_col().find({"project_id": project_id}, {"_id": 0, "image_key": 1, "image_url": 1}))
    if not docs:
        return []

    page_docs = [d for d in docs if d["image_key"].startswith("page:")]
    if page_docs:
        def _page_num(d: Dict[str, Any]) -> int:
            try:
                return int(d["image_key"].replace("page:page-", ""))
            except ValueError:
                return 0
        page_docs.sort(key=_page_num)
        return [{"page_number": _page_num(d), "image_url": d["image_url"]} for d in page_docs]

    panel_docs = []
    for d in docs:
        m = _PANEL_ID_RE.match(d["image_key"])
        if m:
            panel_docs.append((int(m.group(1)), int(m.group(2)), d["image_url"]))
    panel_docs.sort(key=lambda t: (t[0], t[1]))
    return [{"page_number": i + 1, "image_url": url} for i, (_, __, url) in enumerate(panel_docs)]


def _title_from_story(story: str) -> str:
    if not story:
        return "Untitled"
    first_line = story.strip().split("\n")[0].strip()
    return first_line[:80] if first_line else "Untitled"


@router.get("/characters", response_model=List[CharacterSummary])
def list_public_characters(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
) -> List[CharacterSummary]:
    """Return all characters that users have opted to share publicly."""
    chars = list(_char_col().find({"is_public": True}, {"_id": 0}).skip(skip).limit(limit))
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
def list_public_comics(
    limit: int = Query(default=20, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
) -> List[GalleryComicSummary]:
    """Return published comics that have at least one generated page image."""
    docs = list(_proj_col().find({"is_public": True}, {"_id": 0, "user_id": 0}))
    result = []
    for doc in docs:
        project_id = doc.get("project_id", "")
        pages = _project_images_pages(project_id)
        if not pages:
            continue
        cover_url = pages[0]["image_url"]
        user_inputs = doc.get("user_inputs") or {}
        story = user_inputs.get("story_content") or user_inputs.get("storyText") or ""
        result.append(GalleryComicSummary(
            project_id=project_id,
            title=_title_from_story(story),
            genre=user_inputs.get("manga_genre") or user_inputs.get("genre") or "",
            art_style=user_inputs.get("art_style") or "",
            story_synopsis=story[:300],
            cover_image_url=cover_url,
            page_count=len(pages),
            published_at=doc.get("saved_at", ""),
        ))
    sorted_result = sorted(result, key=lambda x: x.published_at, reverse=True)
    return sorted_result[skip: skip + limit]


@router.get("/comics/{project_id}", response_model=GalleryComicDetail)
def get_public_comic(project_id: str) -> GalleryComicDetail:
    """Return full detail for a published comic (for the reader)."""
    doc = _proj_col().find_one({"project_id": project_id, "is_public": True}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Comic not found or not public")
    pages = _project_images_pages(project_id)
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
