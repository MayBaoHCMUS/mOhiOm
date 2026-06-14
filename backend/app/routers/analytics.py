"""Analytics event logging — fire-and-forget event collection for thesis research."""

from datetime import datetime, timezone
from typing import Optional, Any, Dict
from fastapi import APIRouter, Header
from pydantic import BaseModel
from app.database import mongo_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _events_col():
    return mongo_db.get_database()["analytics_events"]


class AnalyticsEvent(BaseModel):
    event: str
    data: Dict[str, Any] = {}


@router.post("/log")
def log_event(
    payload: AnalyticsEvent,
    x_user_id: Optional[str] = Header(None),
):
    """Log any analytics event. Fire-and-forget; never raises to caller."""
    user_id = x_user_id or "anonymous"
    doc = {
        "event":      payload.event,
        "user_id":    user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload.data,
    }
    try:
        _events_col().insert_one(doc)
    except Exception:
        pass  # never fail on analytics
    return {"ok": True}
