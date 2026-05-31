"""
API routes for project save / load.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Any, Dict, List, Optional
from app.schemas import ProjectSaveRequest, ProjectListItem, CharacterSummary
from app.database import mongo_db

router = APIRouter(prefix="/projects", tags=["projects"])


def _col():
    return mongo_db.get_database()["projects"]


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
    """Return all characters with images across a user's saved projects, deduplicated by character_id."""
    user_id = _require_user(x_user_id)
    docs = list(
        _col().find(
            {"user_id": user_id},
            {"_id": 0, "project_id": 1, "steps.step2ImageReview.data.characters": 1},
        )
    )
    seen: set = set()
    result = []
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
                    selected_image_url=char.get("selectedImageUrl") or None,
                    project_id=doc.get("project_id", ""),
                )
            )
    return result


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
