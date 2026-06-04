"""
API routes for project save / load.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header
from typing import Any, Dict, List, Optional
from app.schemas import ProjectSaveRequest, ProjectListItem, CharacterSummary, CharacterUpsertPayload, CharacterPatchPayload, StatsResponse
from app.database import mongo_db

router = APIRouter(prefix="/projects", tags=["projects"])


def _col():
    return mongo_db.get_database()["projects"]


def _char_col():
    return mongo_db.get_database()["user_characters"]


def _require_user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    return x_user_id


@router.post("/save")
def save_project(
    payload: ProjectSaveRequest,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    user_id = _require_user(x_user_id)
    doc = payload.model_dump()
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
    result = []
    for doc in docs:
        steps = doc.get("steps") or {}
        s1 = steps.get("step1") or {}
        s2 = steps.get("step2") or {}
        s2ir = steps.get("step2ImageReview") or {}
        s3 = steps.get("step3") or {}
        s4 = steps.get("step4") or {}
        user_inputs = doc.get("user_inputs") or {}
        result.append(
            ProjectListItem(
                project_id=doc.get("project_id", ""),
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
    doc = {
        "user_id": user_id,
        "character_id": payload.character_id,
        "name": payload.name,
        "prompt": payload.prompt,
        "selected_image_url": payload.selected_image_url,
        "project_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _char_col().insert_one(doc)
    return CharacterSummary(
        character_id=payload.character_id,
        name=payload.name,
        prompt=payload.prompt,
        selected_image_url=payload.selected_image_url,
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
        updates["selected_image_url"] = payload.selected_image_url
    if updates:
        _char_col().update_one({"user_id": user_id, "character_id": character_id}, {"$set": updates})
    char.update(updates)
    return CharacterSummary(
        character_id=character_id,
        name=char.get("name", ""),
        prompt=char.get("prompt"),
        selected_image_url=char.get("selected_image_url"),
        project_id=None,
    )


@router.delete("/characters/{character_id}")
def delete_standalone_character(
    character_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    """Delete a standalone character from the user's library."""
    user_id = _require_user(x_user_id)
    result = _char_col().delete_one({"user_id": user_id, "character_id": character_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
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
    new_char = {
        "characterId": payload.character_id,
        "name": payload.name,
        "prompt": payload.prompt,
        "selectedCandidateId": f"{payload.character_id}-1" if payload.selected_image_url else None,
        "selectedImageUrl": payload.selected_image_url,
    }
    chars.append(new_char)
    _set_characters(_col(), user_id, project_id, chars)
    return CharacterSummary(
        character_id=payload.character_id,
        name=payload.name,
        prompt=payload.prompt,
        selected_image_url=payload.selected_image_url,
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
                char["selectedImageUrl"] = payload.selected_image_url
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


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    x_user_id: Optional[str] = Header(None),
) -> Dict[str, str]:
    user_id = _require_user(x_user_id)
    result = _col().delete_one({"user_id": user_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "deleted"}
