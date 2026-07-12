"""Backend-mediated BYOK image generation.

The built-in GPU render-farm path is untouched and still goes straight from
the frontend to /api/image-proxy -> gpu.mohiom.me; this router only serves
the 'byok' mode, so a decrypted API key never reaches the browser.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import r2_storage
from app.crypto_utils import decrypt_secret
from app.deps import get_current_user_required
from app.image_gen_service import generate_byok_image
from app.providers import IMAGE_GEN_PROVIDERS
from app.services import GeminiServiceError

router = APIRouter(prefix="/image-gen", tags=["image-gen"])


class ImageGenRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: Optional[int] = None
    height: Optional[int] = None


class ImageGenResponse(BaseModel):
    image_url: str


@router.post("/generate", response_model=ImageGenResponse)
async def generate(
    payload: ImageGenRequest,
    user: Dict[str, Any] = Depends(get_current_user_required),
) -> ImageGenResponse:
    cfg = user.get("image_gen_config") or {}
    if cfg.get("mode") != "byok":
        raise HTTPException(status_code=400, detail="Image-gen BYOK is not configured for this account.")

    provider = cfg.get("provider", "")
    provider_info = IMAGE_GEN_PROVIDERS.get(provider)
    if not provider_info:
        raise HTTPException(status_code=400, detail="Unknown or unset image provider.")

    api_key = decrypt_secret(cfg.get("api_key_encrypted", ""))
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key saved for image generation.")

    model = cfg.get("model") or provider_info["default_model"]

    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")
    if payload.negative_prompt.strip():
        # Neither provider's call shape here has a structured negative-prompt
        # field, so fold it into the prompt as an instruction instead.
        prompt = f"{prompt}\n\nAvoid: {payload.negative_prompt.strip()}"

    if not r2_storage.configured():
        raise HTTPException(status_code=503, detail="Image storage is not configured on the server")

    try:
        image_bytes, mime_type = await generate_byok_image(
            provider, prompt, api_key, model, payload.width, payload.height
        )
    except GeminiServiceError as e:
        detail: Any = (
            {"message": str(e), "retry_after_seconds": e.retry_after_seconds}
            if e.retry_after_seconds is not None
            else str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=detail)

    url = r2_storage.upload_bytes(image_bytes, folder="byok-images", content_type=mime_type)
    if not url:
        raise HTTPException(status_code=503, detail="Failed to upload generated image")
    return ImageGenResponse(image_url=url)
