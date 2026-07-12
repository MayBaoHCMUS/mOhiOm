"""API routes for per-user text-generation settings (BYOK / model selection)."""

from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings as app_settings
from app.crud import UserRepository
from app.crypto_utils import encrypt_secret
from app.database import mongo_db
from app.deps import get_current_user_required
from app.providers import TEXT_GEN_PROVIDERS, IMAGE_GEN_PROVIDERS

router = APIRouter(prefix="/settings", tags=["settings"])

TextGenMode = Literal["byok", "nine_router", "local_server"]
ImageGenMode = Literal["builtin", "byok"]


class TextGenConfigIn(BaseModel):
    mode: TextGenMode
    provider: str = ""  # required for "byok" — must be a key in TEXT_GEN_PROVIDERS
    api_url: str = ""   # used by "local_server" only
    model: str = ""     # used by "nine_router" (required) and "local_server" (optional)
    api_key: str = ""   # plaintext in transit over HTTPS; encrypted before storage; blank = keep existing key


class TextGenConfigOut(BaseModel):
    mode: TextGenMode = "nine_router"
    provider: str = ""
    api_url: str = ""
    model: str = ""
    has_api_key: bool = False


class NineRouterModelsOut(BaseModel):
    models: List[str]


class TextGenProviderOut(BaseModel):
    id: str
    label: str


class TextGenProvidersOut(BaseModel):
    providers: List[TextGenProviderOut]


class ImageGenConfigIn(BaseModel):
    mode: ImageGenMode
    provider: str = ""  # required for "byok" — must be a key in IMAGE_GEN_PROVIDERS
    model: str = ""     # optional override of the provider's default_model
    api_key: str = ""   # plaintext in transit over HTTPS; encrypted before storage; blank = keep existing key


class ImageGenConfigOut(BaseModel):
    mode: ImageGenMode = "builtin"
    provider: str = ""
    model: str = ""
    has_api_key: bool = False


class ImageGenProviderOut(BaseModel):
    id: str
    label: str


class ImageGenProvidersOut(BaseModel):
    providers: List[ImageGenProviderOut]


def _repo() -> UserRepository:
    db = mongo_db.get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return UserRepository(db["users"])


def _available_nine_router_models() -> List[str]:
    raw = app_settings.NINE_ROUTER_AVAILABLE_MODELS.strip()
    if not raw:
        return [app_settings.NINE_ROUTER_MODEL]
    return [m.strip() for m in raw.split(",") if m.strip()]


@router.get("/nine-router-models", response_model=NineRouterModelsOut)
async def get_nine_router_models():
    return NineRouterModelsOut(models=_available_nine_router_models())


@router.get("/text-gen-providers", response_model=TextGenProvidersOut)
async def get_text_gen_providers():
    return TextGenProvidersOut(
        providers=[
            TextGenProviderOut(id=provider_id, label=info["label"])
            for provider_id, info in TEXT_GEN_PROVIDERS.items()
        ]
    )


@router.get("/text-gen-config", response_model=TextGenConfigOut)
async def get_text_gen_config(user: Dict[str, Any] = Depends(get_current_user_required)):
    cfg = await _repo().get_text_gen_config(str(user["_id"])) or {}
    return TextGenConfigOut(
        mode=cfg.get("mode", "nine_router"),
        provider=cfg.get("provider", ""),
        api_url=cfg.get("api_url", ""),
        model=cfg.get("model", ""),
        has_api_key=bool(cfg.get("api_key_encrypted")),
    )


@router.put("/text-gen-config", response_model=TextGenConfigOut)
async def put_text_gen_config(
    payload: TextGenConfigIn, user: Dict[str, Any] = Depends(get_current_user_required)
):
    repo = _repo()
    existing = await repo.get_text_gen_config(str(user["_id"])) or {}
    api_key_encrypted = existing.get("api_key_encrypted", "")

    if payload.mode == "byok":
        if payload.provider.strip() not in TEXT_GEN_PROVIDERS:
            raise HTTPException(status_code=400, detail="Unknown provider.")
        if payload.api_key.strip():
            api_key_encrypted = encrypt_secret(payload.api_key.strip())
        if not api_key_encrypted:
            raise HTTPException(status_code=400, detail="API key is required for 'byok' mode.")
    elif payload.mode == "nine_router":
        if not payload.model.strip():
            raise HTTPException(status_code=400, detail="Model is required for 'nine_router' mode.")
        if payload.model.strip() not in _available_nine_router_models():
            raise HTTPException(status_code=400, detail="Model is not in the list of available models.")
        api_key_encrypted = ""
    elif payload.mode == "local_server":
        if not payload.api_url.strip():
            raise HTTPException(status_code=400, detail="API URL is required for 'local_server' mode.")
        api_key_encrypted = ""

    config = {
        "mode": payload.mode,
        "provider": payload.provider.strip() if payload.mode == "byok" else "",
        "api_url": payload.api_url.strip().rstrip("/") if payload.mode == "local_server" else "",
        "model": payload.model.strip() if payload.mode in ("nine_router", "local_server") else "",
        "api_key_encrypted": api_key_encrypted,
    }
    await repo.set_text_gen_config(str(user["_id"]), config)
    return TextGenConfigOut(
        mode=config["mode"],
        provider=config["provider"],
        api_url=config["api_url"],
        model=config["model"],
        has_api_key=bool(api_key_encrypted),
    )


@router.delete("/text-gen-config", response_model=TextGenConfigOut)
async def delete_text_gen_config(user: Dict[str, Any] = Depends(get_current_user_required)):
    await _repo().clear_text_gen_config(str(user["_id"]))
    return TextGenConfigOut()


@router.get("/image-gen-providers", response_model=ImageGenProvidersOut)
async def get_image_gen_providers():
    return ImageGenProvidersOut(
        providers=[
            ImageGenProviderOut(id=provider_id, label=info["label"])
            for provider_id, info in IMAGE_GEN_PROVIDERS.items()
        ]
    )


@router.get("/image-gen-config", response_model=ImageGenConfigOut)
async def get_image_gen_config(user: Dict[str, Any] = Depends(get_current_user_required)):
    cfg = await _repo().get_image_gen_config(str(user["_id"])) or {}
    return ImageGenConfigOut(
        mode=cfg.get("mode", "builtin"),
        provider=cfg.get("provider", ""),
        model=cfg.get("model", ""),
        has_api_key=bool(cfg.get("api_key_encrypted")),
    )


@router.put("/image-gen-config", response_model=ImageGenConfigOut)
async def put_image_gen_config(
    payload: ImageGenConfigIn, user: Dict[str, Any] = Depends(get_current_user_required)
):
    repo = _repo()
    existing = await repo.get_image_gen_config(str(user["_id"])) or {}
    api_key_encrypted = existing.get("api_key_encrypted", "")

    if payload.mode == "byok":
        if payload.provider.strip() not in IMAGE_GEN_PROVIDERS:
            raise HTTPException(status_code=400, detail="Unknown provider.")
        if payload.api_key.strip():
            api_key_encrypted = encrypt_secret(payload.api_key.strip())
        if not api_key_encrypted:
            raise HTTPException(status_code=400, detail="API key is required for 'byok' mode.")
    else:  # builtin
        api_key_encrypted = ""

    config = {
        "mode": payload.mode,
        "provider": payload.provider.strip() if payload.mode == "byok" else "",
        "model": payload.model.strip() if payload.mode == "byok" else "",
        "api_key_encrypted": api_key_encrypted,
    }
    await repo.set_image_gen_config(str(user["_id"]), config)
    return ImageGenConfigOut(
        mode=config["mode"],
        provider=config["provider"],
        model=config["model"],
        has_api_key=bool(api_key_encrypted),
    )


@router.delete("/image-gen-config", response_model=ImageGenConfigOut)
async def delete_image_gen_config(user: Dict[str, Any] = Depends(get_current_user_required)):
    await _repo().clear_image_gen_config(str(user["_id"]))
    return ImageGenConfigOut()
