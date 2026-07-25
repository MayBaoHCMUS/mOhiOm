"""Shared FastAPI auth dependencies for routes that need the current logged-in user."""

from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request, status

from app.config import settings
from app.crud import UserRepository
from app.database import mongo_db
from app.routers.auth import token_from_request
from app.security import decode_token


async def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Return the Mongo user doc for a valid session cookie/bearer token, or None. Never raises."""
    token = token_from_request(request)
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    db = mongo_db.get_database()
    if db is None:
        return None
    return await UserRepository(db["users"]).get_by_id(user_id)


async def get_current_user_required(request: Request) -> Dict[str, Any]:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def admin_emails() -> List[str]:
    """The allowlist, normalized. Emails are stored lowercased by upsert_oauth_user."""
    return [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]


async def require_admin_user(request: Request) -> Dict[str, Any]:
    """Gate /admin on a Google sign-in whose email is on the allowlist.

    Both halves matter. The email alone is not enough: a password account could be
    registered against the same address, so we also require the Google identity to
    be linked — the OAuth provider is what actually proves ownership of the inbox.
    """
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    email = (user.get("email") or "").strip().lower()
    if not email or email not in admin_emails():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if not (user.get("oauth") or {}).get("google"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access requires signing in with Google",
        )

    return user
