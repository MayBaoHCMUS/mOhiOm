"""API routes for per-user onboarding state (welcome modal, tour, checklist)."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.crud import UserRepository
from app.database import mongo_db
from app.deps import get_current_user_required

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingStateModel(BaseModel):
    completed: bool = False
    skipped: bool = False
    currentStep: int = 0
    welcomeSeen: bool = False
    tourCompleted: bool = False
    createStory: bool = False
    runPipeline: bool = False
    generateImage: bool = False
    addDialogue: bool = False
    publishComic: bool = False
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None


def _repo() -> UserRepository:
    db = mongo_db.get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return UserRepository(db["users"])


@router.get("", response_model=OnboardingStateModel)
async def get_onboarding_state(user: Dict[str, Any] = Depends(get_current_user_required)):
    state = await _repo().get_onboarding_state(str(user["_id"])) or {}
    return OnboardingStateModel(**{k: v for k, v in state.items() if k in OnboardingStateModel.model_fields})


@router.put("", response_model=OnboardingStateModel)
async def put_onboarding_state(
    payload: OnboardingStateModel, user: Dict[str, Any] = Depends(get_current_user_required)
):
    repo = _repo()
    await repo.set_onboarding_state(str(user["_id"]), payload.model_dump())
    return payload
