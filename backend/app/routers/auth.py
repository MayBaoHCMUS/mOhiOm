from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse, JSONResponse
from app.config import settings
from app.database import mongo_db
from app.schemas import (
    AuthRegister,
    AuthLogin,
    AuthResponse,
    OAuthStartResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
    UserPublic,
    AuthMeResponse,
)
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_oauth_state,
    decode_token,
    hash_reset_token,
)
from app.crud import UserRepository
from app.emailer import send_password_reset_email
from typing import Dict, Any
import httpx
import secrets
from urllib.parse import urlencode, quote
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/auth", tags=["auth"])

_indexes_ready = False


def get_user_repo() -> UserRepository:
    global _indexes_ready
    db = mongo_db.get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    collection = db["users"]
    if not _indexes_ready:
        collection.create_index("email", unique=True, sparse=True)
        collection.create_index([("oauth.google.id", 1)], unique=True, sparse=True)
        collection.create_index([("oauth.github.id", 1)], unique=True, sparse=True)
        _indexes_ready = True
    return UserRepository(collection)


def public_user(doc: Dict[str, Any]) -> UserPublic:
    return UserPublic(**UserRepository._public_user(doc))


def auth_redirect_url(provider: str) -> str:
    return f"{settings.AUTH_BACKEND_URL}{settings.API_PREFIX}/auth/oauth/{provider}/callback"


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/",
    )


def token_from_request(request: Request) -> str | None:
    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip() or None
    return None


@router.post("/register", response_model=AuthResponse)
async def register(payload: AuthRegister):
    repo = get_user_repo()
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(payload.password)
    user_doc = await repo.create_manual_user(
        {
            "email": payload.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "password_hash": hashed,
        }
    )

    token = create_access_token({"sub": str(user_doc["_id"]), "email": user_doc.get("email")})
    response = JSONResponse(
        content=AuthResponse(
            message="Account created successfully.",
            user=public_user(user_doc),
        ).model_dump(exclude_none=True)
    )
    set_auth_cookie(response, token)
    return response


@router.post("/login", response_model=AuthResponse)
async def login(payload: AuthLogin):
    repo = get_user_repo()
    user_doc = await repo.get_by_email(payload.email)
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user_doc["_id"]), "email": user_doc.get("email")})
    response = JSONResponse(
        content=AuthResponse(
            message="Signed in successfully.",
            user=public_user(user_doc),
        ).model_dump(exclude_none=True)
    )
    set_auth_cookie(response, token)
    return response


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest):
    repo = get_user_repo()
    user_doc = await repo.get_by_email(payload.email)

    if user_doc:
        token = secrets.token_urlsafe(32)
        token_hash = hash_reset_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES
        )
        await repo.set_password_reset(payload.email, token_hash, expires_at)

        reset_url = (
            f"{settings.AUTH_FRONTEND_URL}/reset-password"
            f"?token={quote(token)}&email={quote(payload.email)}"
        )
        send_password_reset_email(payload.email, reset_url)

    return MessageResponse(message="If the account exists, a reset link will be sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest):
    repo = get_user_repo()
    user_doc = await repo.get_by_email(payload.email)
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expected_hash = user_doc.get("reset_token_hash")
    expires_at = user_doc.get("reset_token_expires_at")
    if not expected_hash or not expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if hash_reset_token(payload.token) != expected_hash:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    await repo.update_password(str(user_doc["_id"]), hash_password(payload.password))
    await repo.clear_password_reset(str(user_doc["_id"]))
    return MessageResponse(message="Password updated. You can sign in now.")


@router.get("/me", response_model=AuthMeResponse)
async def me(request: Request):
    repo = get_user_repo()
    token = token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_doc = await repo.get_by_id(user_id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return AuthMeResponse(user=public_user(user_doc))


@router.post("/logout", response_model=MessageResponse)
async def logout():
    response = JSONResponse(content=MessageResponse(message="Signed out.").model_dump())
    clear_auth_cookie(response)
    return response


@router.get("/oauth/{provider}/start", response_model=OAuthStartResponse)
async def oauth_start(provider: str, mode: str = Query("login", pattern="^(login|register)$")):
    provider = provider.lower()
    if provider not in ("google", "github"):
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if provider == "google" and not settings.OAUTH_GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    if provider == "github" and not settings.OAUTH_GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    state = create_oauth_state({"provider": provider, "mode": mode, "nonce": secrets.token_urlsafe(16)})
    redirect_uri = auth_redirect_url(provider)

    if provider == "google":
        query = urlencode(
            {
                "client_id": settings.OAUTH_GOOGLE_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "offline",
            }
        )
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
    else:
        query = urlencode(
            {
                "client_id": settings.OAUTH_GITHUB_CLIENT_ID,
                "redirect_uri": redirect_uri,
                "scope": "read:user user:email",
                "state": state,
            }
        )
        url = f"https://github.com/login/oauth/authorize?{query}"

    return OAuthStartResponse(url=url)


async def exchange_google_code(code: str, redirect_uri: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.OAUTH_GOOGLE_CLIENT_ID,
                "client_secret": settings.OAUTH_GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Google token exchange failed")

        user_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_resp.raise_for_status()
        info = user_resp.json()

    return {
        "id": info.get("sub"),
        "email": info.get("email"),
        "first_name": info.get("given_name"),
        "last_name": info.get("family_name"),
        "avatar": info.get("picture"),
    }


async def exchange_github_code(code: str, redirect_uri: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.OAUTH_GITHUB_CLIENT_ID,
                "client_secret": settings.OAUTH_GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="GitHub token exchange failed")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_resp.raise_for_status()
        user_info = user_resp.json()

        email = user_info.get("email")
        if not email:
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            email_resp.raise_for_status()
            emails = email_resp.json()
            primary = next((item for item in emails if item.get("primary")), None)
            verified = next((item for item in emails if item.get("verified")), None)
            selected = primary or verified or (emails[0] if emails else None)
            email = selected.get("email") if selected else None

    name = user_info.get("name") or ""
    parts = name.split(" ", 1)

    return {
        "id": str(user_info.get("id")),
        "email": email,
        "first_name": parts[0] if parts else None,
        "last_name": parts[1] if len(parts) > 1 else None,
        "avatar": user_info.get("avatar_url"),
    }


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str | None = None, state: str | None = None):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")

    try:
        state_payload = decode_token(state)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc

    if state_payload.get("typ") != "oauth_state" or state_payload.get("provider") != provider.lower():
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    redirect_uri = auth_redirect_url(provider)
    repo = get_user_repo()

    if provider == "google":
        profile = await exchange_google_code(code, redirect_uri)
    elif provider == "github":
        profile = await exchange_github_code(code, redirect_uri)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if not profile.get("id"):
        raise HTTPException(status_code=400, detail="OAuth profile missing id")

    user_doc = await repo.upsert_oauth_user(provider, profile)
    token = create_access_token({"sub": str(user_doc["_id"]), "email": user_doc.get("email")})

    redirect_to = (
        f"{settings.AUTH_FRONTEND_URL}/callback"
        f"?provider={provider}"
        f"&mode={state_payload.get('mode', 'login')}"
    )
    response = RedirectResponse(url=redirect_to, status_code=302)
    set_auth_cookie(response, token)
    return response
