"""
API routes for project save / load.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from typing import Any, Dict, List, Optional
from app.schemas import ProjectSaveRequest, ProjectListItem, CharacterSummary, CharacterUpsertPayload, CharacterPatchPayload, StatsResponse, ProjectPublishPayload, ProjectImageEntry, ProjectImagesSaveRequest, ProjectImagesResponse
from app.database import mongo_db
from app import r2_storage

router = APIRouter(prefix="/projects", tags=["projects"])


def _col():
    return mongo_db.get_database()["projects"]


def _char_col():
    return mongo_db.get_database()["user_characters"]


def _img_col():
    return mongo_db.get_database()["project_images"]


def _require_user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    return x_user_id


def _has_success_page(steps: Dict[str, Any]) -> bool:
    """True if step4 has at least one page that actually finished rendering.
    Legacy path — current saves never populate step4.data.pageStates, so this is
    effectively always False. Real image data lives in the project_images
    collection instead; see _has_generated_images below, which is what
    list_projects() actually relies on."""
    page_states = (((steps.get("step4") or {}).get("data") or {}).get("pageStates") or {})
    return any(
        state.get("status") == "success" and state.get("imageUrl")
        for state in page_states.values()
    )


def _maybe_upload(url: Optional[str], folder: str) -> Optional[str]:
    """Safety net for character endpoints, which never go through save_project()'s
    steps-blob sanitizer: upload a lingering base64 data URL to R2 if one slips
    through, otherwise pass the value (a real URL, or None) through unchanged."""
    if url and url.startswith("data:image/") and r2_storage.configured():
        return r2_storage.upload_image_base64(url, folder=folder) or url
    return url


@router.post("/save")
def save_project(
    payload: ProjectSaveRequest,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    user_id = _require_user(x_user_id)
    doc = payload.model_dump()
    doc["steps"] = r2_storage.sanitize_base64_in_place(doc["steps"], folder=f"steps/{payload.project_id}")
    doc["user_id"] = user_id
    _col().update_one(
        {"user_id": user_id, "project_id": payload.project_id},
        {"$set": doc},
        upsert=True,
    )
    return {"message": "saved"}


@router.get("/", response_model=List[ProjectListItem])
def list_projects(
    x_user_id: Optional[str] = Header(None),
) -> List[Dict[str, Any]]:
    user_id = _require_user(x_user_id)
    docs = list(_col().find({"user_id": user_id}, {"_id": 0, "user_id": 0}))
    # Real generated-image data lives in project_images (saved via POST
    # /{project_id}/images), not in step4.data.pageStates — fetch which
    # projects have at least one saved image in a single query rather than
    # per-project, since _has_success_page alone is essentially always False.
    projects_with_images = set(_img_col().distinct("project_id", {"user_id": user_id}))
    result = []
    for doc in docs:
        steps = doc.get("steps") or {}
        s1 = steps.get("step1") or {}
        s2 = steps.get("step2") or {}
        s2ir = steps.get("step2ImageReview") or {}
        s3 = steps.get("step3") or {}
        s4 = steps.get("step4") or {}
        user_inputs = doc.get("user_inputs") or {}
        project_id = doc.get("project_id", "")
        result.append(
            ProjectListItem(
                project_id=project_id,
                saved_at=doc.get("saved_at", ""),
                genre=user_inputs.get("genre") or None,
                has_step1=bool(s1.get("data")),
                has_step2=bool(s2.get("data")),
                has_step2_images=bool(s2ir.get("data")),
                has_step3=bool(s3.get("data")),
                has_step4=bool(s4.get("data")),
                step1_approved=bool(s1.get("isApproved")),
                step2_approved=bool(s2.get("isApproved")),
                step2_images_approved=bool(s2ir.get("isApproved")),
                step3_approved=bool(s3.get("isApproved")),
                is_public=bool(doc.get("is_public", False)),
                is_publishable=project_id in projects_with_images or _has_success_page(steps),
            )
        )
    return sorted(result, key=lambda x: x.saved_at, reverse=True)


@router.get("/characters", response_model=List[CharacterSummary])
def list_characters(
    x_user_id: Optional[str] = Header(None),
) -> List[Dict[str, Any]]:
    """Return all characters across a user's standalone library and saved projects, deduplicated by character_id."""
    user_id = _require_user(x_user_id)
    seen: set = set()
    result = []

    # 1. Standalone characters (user_characters collection)
    for char in _char_col().find({"user_id": user_id}, {"_id": 0}):
        char_id = char.get("character_id", "")
        if not char_id or char_id in seen:
            continue
        seen.add(char_id)
        result.append(
            CharacterSummary(
                character_id=char_id,
                name=char.get("name", ""),
                prompt=char.get("prompt") or None,
                selected_image_url=char.get("selected_image_url") or None,
                project_id=char.get("project_id") or None,
                is_public=bool(char.get("is_public", False)),
            )
        )

    # 2. Characters embedded in project documents
    docs = list(
        _col().find(
            {"user_id": user_id},
            {"_id": 0, "project_id": 1, "steps.step2ImageReview.data.characters": 1},
        )
    )
    for doc in docs:
        chars = (
            ((doc.get("steps") or {}).get("step2ImageReview") or {}).get("data") or {}
        ).get("characters") or []
        for char in chars:
            char_id = char.get("characterId", "")
            if not char_id or char_id in seen:
                continue
            seen.add(char_id)
            result.append(
                CharacterSummary(
                    character_id=char_id,
                    name=char.get("name", ""),
                    prompt=char.get("prompt") or None,
                    selected_image_url=char.get("selectedImageUrl") or None,
                    project_id=doc.get("project_id") or None,
                )
            )
    return result


@router.post("/characters", response_model=CharacterSummary)
def create_standalone_character(
    payload: CharacterUpsertPayload,
    x_user_id: Optional[str] = Header(None),
) -> CharacterSummary:
    """Save a character to the user's standalone library (no project required)."""
    user_id = _require_user(x_user_id)
    existing = _char_col().find_one({"user_id": user_id, "character_id": payload.character_id})
    if existing:
        raise HTTPException(status_code=409, detail="Character ID already exists")
    selected_image_url = _maybe_upload(payload.selected_image_url, folder="characters")
    doc = {
        "user_id": user_id,
        "character_id": payload.character_id,
        "name": payload.name,
        "prompt": payload.prompt,
        "selected_image_url": selected_image_url,
        "project_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _char_col().insert_one(doc)
    return CharacterSummary(
        character_id=payload.character_id,
        name=payload.name,
        prompt=payload.prompt,
        selected_image_url=selected_image_url,
        project_id=None,
    )


@router.patch("/characters/{character_id}", response_model=CharacterSummary)
def update_standalone_character(
    character_id: str,
    payload: CharacterPatchPayload,
    x_user_id: Optional[str] = Header(None),
) -> CharacterSummary:
    """Update a standalone character in the user's library."""
    user_id = _require_user(x_user_id)
    char = _char_col().find_one({"user_id": user_id, "character_id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    updates: Dict[str, Any] = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.prompt is not None:
        updates["prompt"] = payload.prompt
    if payload.selected_image_url is not None:
        updates["selected_image_url"] = _maybe_upload(payload.selected_image_url, folder="characters")
    if payload.is_public is not None:
        updates["is_public"] = payload.is_public
    if updates:
        _char_col().update_one({"user_id": user_id, "character_id": character_id}, {"$set": updates})
    char.update(updates)
    return CharacterSummary(
        character_id=character_id,
        name=char.get("name", ""),
        prompt=char.get("prompt"),
        selected_image_url=char.get("selected_image_url"),
        project_id=None,
        is_public=bool(char.get("is_public", False)),
    )


@router.delete("/characters/{character_id}")
def delete_standalone_character(
    character_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    """Delete a standalone character from the user's library."""
    user_id = _require_user(x_user_id)
    char = _char_col().find_one({"user_id": user_id, "character_id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    _char_col().delete_one({"user_id": user_id, "character_id": character_id})
    if char.get("selected_image_url"):
        r2_storage.delete_by_url(char["selected_image_url"])
    return {"message": "deleted"}


def _get_characters(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    return (
        ((doc.get("steps") or {}).get("step2ImageReview") or {})
        .get("data") or {}
    ).get("characters") or []


def _set_characters(col, user_id: str, project_id: str, chars: List[Dict[str, Any]]) -> None:
    col.update_one(
        {"user_id": user_id, "project_id": project_id},
        {"$set": {"steps.step2ImageReview.data.characters": chars}},
    )


@router.post("/{project_id}/characters", response_model=CharacterSummary)
def create_character(
    project_id: str,
    payload: CharacterUpsertPayload,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user_id = _require_user(x_user_id)
    doc = _col().find_one({"user_id": user_id, "project_id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    chars = _get_characters(doc)
    if any(c.get("characterId") == payload.character_id for c in chars):
        raise HTTPException(status_code=409, detail="Character ID already exists in this project")
    selected_image_url = _maybe_upload(payload.selected_image_url, folder="characters")
    new_char = {
        "characterId": payload.character_id,
        "name": payload.name,
        "prompt": payload.prompt,
        "selectedCandidateId": f"{payload.character_id}-1" if selected_image_url else None,
        "selectedImageUrl": selected_image_url,
    }
    chars.append(new_char)
    _set_characters(_col(), user_id, project_id, chars)
    return CharacterSummary(
        character_id=payload.character_id,
        name=payload.name,
        prompt=payload.prompt,
        selected_image_url=selected_image_url,
        project_id=project_id,
    )


@router.patch("/{project_id}/characters/{character_id}", response_model=CharacterSummary)
def update_character(
    project_id: str,
    character_id: str,
    payload: CharacterPatchPayload,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user_id = _require_user(x_user_id)
    doc = _col().find_one({"user_id": user_id, "project_id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    chars = _get_characters(doc)
    for char in chars:
        if char.get("characterId") == character_id:
            if payload.name is not None:
                char["name"] = payload.name
            if payload.prompt is not None:
                char["prompt"] = payload.prompt
            if payload.selected_image_url is not None:
                char["selectedImageUrl"] = _maybe_upload(payload.selected_image_url, folder="characters")
                char["selectedCandidateId"] = f"{character_id}-updated"
            _set_characters(_col(), user_id, project_id, chars)
            return CharacterSummary(
                character_id=character_id,
                name=char.get("name", ""),
                prompt=char.get("prompt"),
                selected_image_url=char.get("selectedImageUrl"),
                project_id=project_id,
            )
    raise HTTPException(status_code=404, detail="Character not found in project")


@router.delete("/{project_id}/characters/{character_id}")
def delete_character(
    project_id: str,
    character_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    user_id = _require_user(x_user_id)
    doc = _col().find_one({"user_id": user_id, "project_id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    chars = _get_characters(doc)
    next_chars = [c for c in chars if c.get("characterId") != character_id]
    if len(next_chars) == len(chars):
        raise HTTPException(status_code=404, detail="Character not found in project")
    _set_characters(_col(), user_id, project_id, next_chars)
    removed = next(c for c in chars if c.get("characterId") == character_id)
    if removed.get("selectedImageUrl"):
        r2_storage.delete_by_url(removed["selectedImageUrl"])
    return {"message": "deleted"}


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    x_user_id: Optional[str] = Header(None),
) -> StatsResponse:
    user_id = _require_user(x_user_id)

    project_count = _col().count_documents({"user_id": user_id})

    standalone_ids = {
        doc["character_id"]
        for doc in _char_col().find({"user_id": user_id}, {"character_id": 1})
        if doc.get("character_id")
    }

    project_char_ids: set = set()
    panel_count = 0
    for doc in _col().find(
        {"user_id": user_id},
        {"steps.step2ImageReview.data.characters.characterId": 1, "steps.step4.data.panels": 1},
    ):
        steps = doc.get("steps") or {}
        for c in (((steps.get("step2ImageReview") or {}).get("data") or {}).get("characters") or []):
            if c.get("characterId"):
                project_char_ids.add(c["characterId"])
        panels = ((steps.get("step4") or {}).get("data") or {}).get("panels") or []
        panel_count += len(panels)

    return StatsResponse(
        project_count=project_count,
        character_count=len(standalone_ids | project_char_ids),
        panel_count=panel_count,
    )


@router.get("/{project_id}")
def load_project(
    project_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user_id = _require_user(x_user_id)
    doc = _col().find_one(
        {"user_id": user_id, "project_id": project_id},
        {"_id": 0, "user_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


@router.post("/{project_id}/images")
def save_project_images(
    project_id: str,
    payload: ProjectImagesSaveRequest,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user_id = _require_user(x_user_id)
    if not _col().find_one({"user_id": user_id, "project_id": project_id}):
        raise HTTPException(status_code=404, detail="Project not found")
    now = datetime.now(timezone.utc).isoformat()
    # Replace the full image set atomically so stale keys (e.g. old Full-Page images
    # after the user switches to Panel mode) are never left behind.
    for old in _img_col().find({"user_id": user_id, "project_id": project_id}, {"image_url": 1}):
        if old.get("image_url"):
            r2_storage.delete_by_url(old["image_url"])
    _img_col().delete_many({"user_id": user_id, "project_id": project_id})
    if payload.images:
        _img_col().insert_many([
            {"user_id": user_id, "project_id": project_id,
             "image_key": entry.image_key, "image_url": entry.image_url, "saved_at": now}
            for entry in payload.images
        ])
    return {"saved": len(payload.images), "message": "images saved"}


@router.get("/{project_id}/images", response_model=ProjectImagesResponse)
def load_project_images(
    project_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user_id = _require_user(x_user_id)
    docs = list(_img_col().find(
        {"user_id": user_id, "project_id": project_id},
        {"_id": 0, "user_id": 0, "project_id": 0, "saved_at": 0},
    ))
    return {"images": docs}


@router.patch("/{project_id}/publish")
def publish_project(
    project_id: str,
    payload: ProjectPublishPayload,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Toggle a project's public visibility in the community gallery."""
    user_id = _require_user(x_user_id)
    result = _col().update_one(
        {"user_id": user_id, "project_id": project_id},
        {"$set": {"is_public": payload.is_public}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project_id": project_id, "is_public": payload.is_public}


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    user_id = _require_user(x_user_id)
    if not _col().find_one({"user_id": user_id, "project_id": project_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Project not found")

    for img in _img_col().find({"user_id": user_id, "project_id": project_id}, {"image_url": 1}):
        if img.get("image_url"):
            r2_storage.delete_by_url(img["image_url"])

    _col().delete_one({"user_id": user_id, "project_id": project_id})
    _img_col().delete_many({"user_id": user_id, "project_id": project_id})
    r2_storage.delete_by_prefix(f"steps/{project_id}")
    return {"message": "deleted"}
