"""SUS (System Usability Scale) survey collection — thesis user-study data.

POST is public so participants can submit without an account. Reading and clearing
the dataset are admin-only: the responses are study data, and the results view lives
in /admin behind a Google sign-in on the allowlist.
"""

import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.database import mongo_db
from app.deps import require_admin_user

router = APIRouter(prefix="/survey", tags=["survey"])


def _sus_col():
    return mongo_db.get_database()["sus_responses"]


class SUSAnswers(BaseModel):
    """Likert value (1-5) for each of the 10 standard SUS questions."""
    q1: int = Field(..., ge=1, le=5)
    q2: int = Field(..., ge=1, le=5)
    q3: int = Field(..., ge=1, le=5)
    q4: int = Field(..., ge=1, le=5)
    q5: int = Field(..., ge=1, le=5)
    q6: int = Field(..., ge=1, le=5)
    q7: int = Field(..., ge=1, le=5)
    q8: int = Field(..., ge=1, le=5)
    q9: int = Field(..., ge=1, le=5)
    q10: int = Field(..., ge=1, le=5)


class SUSSubmitRequest(BaseModel):
    participant_id: str
    answers: SUSAnswers
    score: int = Field(..., ge=0, le=100)
    task_id: Optional[str] = None
    submitted_at: Optional[str] = None  # ISO string from the client clock


def _server_score(a: SUSAnswers) -> int:
    """Recompute the SUS score independently of whatever the client sent.

    Odd-numbered questions are positively worded (contribute val - 1), even-numbered
    ones are negatively worded (contribute 5 - val). Sum x 2.5 maps 0-40 onto 0-100.

    Rounds half *up* rather than using round(), which rounds half to even: an odd item
    total lands on x.5, so round(72.5) would give 72 while the participant was shown 73
    by Math.round() in calcSUSScore. Half the responses would disagree by a point.
    """
    vals = [a.q1, a.q2, a.q3, a.q4, a.q5, a.q6, a.q7, a.q8, a.q9, a.q10]
    total = sum((v - 1) if i % 2 == 0 else (5 - v) for i, v in enumerate(vals))
    return math.floor(total * 2.5 + 0.5)


def _parse_iso(value: Optional[str], fallback: datetime) -> datetime:
    """Parse a client ISO timestamp, tolerating JS's trailing 'Z' and junk values.

    A wrong clock on a participant's device must never cost us their response.
    """
    if not value:
        return fallback
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return fallback


@router.post("/sus", status_code=201)
def submit_sus(payload: SUSSubmitRequest):
    """Save one SUS response. The stored score is always the server-computed one."""
    now = datetime.now(timezone.utc)
    score = _server_score(payload.answers)

    doc = {
        "participant_id": payload.participant_id.strip(),
        "answers": payload.answers.model_dump(),
        "score": score,
        "client_score": payload.score,  # kept for audit — never used as the truth
        "task_id": payload.task_id,
        "submitted_at": _parse_iso(payload.submitted_at, now),
        "created_at": now,
    }
    result = _sus_col().insert_one(doc)
    return {"status": "saved", "id": str(result.inserted_id), "score": score}


@router.get("/sus")
def get_sus_responses(_admin=Depends(require_admin_user)):
    """All responses, newest first — powers the researcher results view."""
    docs = list(_sus_col().find({}).sort("created_at", -1).limit(500))

    responses = [
        {
            "id": str(d["_id"]),
            "participant_id": d["participant_id"],
            "answers": d["answers"],
            "score": d["score"],
            "task_id": d.get("task_id"),
            "submitted_at": d["submitted_at"].isoformat(),
            "created_at": d["created_at"].isoformat(),
        }
        for d in docs
    ]
    scores = [r["score"] for r in responses]
    return {
        "status": "success",
        "count": len(responses),
        "mean_score": round(sum(scores) / len(scores), 1) if scores else None,
        "responses": responses,
    }


@router.delete("/sus")
def clear_sus_responses(_admin=Depends(require_admin_user)):
    """Wipe the collection — for resetting between study sessions."""
    result = _sus_col().delete_many({})
    return {"status": "cleared", "deleted_count": result.deleted_count}
