"""
API routes for Gemini-based text generation and analysis.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.config import settings
from app.rate_limit import PerUserRateLimiter, QueueFullError, RateLimitExceededError
from app.services import GeminiService, GeminiServiceError

router = APIRouter(prefix="/gemini", tags=["gemini"])

gemini_rate_limiter = PerUserRateLimiter(
    requests_per_second=settings.GEMINI_REQUESTS_PER_SECOND,
    max_queue_size=settings.GEMINI_MAX_QUEUE_SIZE,
    max_wait_seconds=settings.GEMINI_MAX_QUEUE_WAIT_SECONDS,
)

# Initialize Gemini service with graceful degradation when dependencies or env vars are missing
try:
    gemini_service = GeminiService()
    gemini_error_message = None
except (ValueError, ImportError) as e:
    gemini_service = None
    gemini_error_message = str(e)


class TextGenerationRequest(BaseModel):
    """Request model for text generation."""

    prompt: str


class StoryAnalysisRequest(BaseModel):
    """Request model for story analysis."""

    story_text: str
    num_chapters: int = 3


class CharacterPromptRequest(BaseModel):
    """Request model for character prompt generation."""

    character_description: str


class PanelScriptRequest(BaseModel):
    """Request model for panel script generation."""

    scene_description: str


def _resolve_user_key(request: Request) -> str:
    header_user_id = request.headers.get("x-user-id")
    if header_user_id:
        return f"user:{header_user_id[:64]}"

    client_host = request.client.host if request.client else "anonymous"
    return f"ip:{client_host}"


async def _acquire_limit_token(request: Request):
    try:
        return await gemini_rate_limiter.acquire(_resolve_user_key(request))
    except QueueFullError as exc:
        raise HTTPException(
            status_code=429,
            detail={"message": str(exc), "retry_after_seconds": 1},
        ) from exc
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Rate limit exceeded for this user. Please retry shortly.",
                "retry_after_seconds": round(exc.retry_after_seconds, 2),
            },
        ) from exc


@router.post("/generate-text")
async def generate_text(request: TextGenerationRequest, http_request: Request):
    """Generate text using Gemini API."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        result = await gemini_service.generate_text(request.prompt)
        return {"generated_text": result}
    except GeminiServiceError as e:
        detail = (
            {"message": str(e), "retry_after_seconds": e.retry_after_seconds}
            if e.retry_after_seconds is not None
            else str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        limit_token.release()


@router.post("/analyze-story")
async def analyze_story(request: StoryAnalysisRequest, http_request: Request):
    """Analyze a story for comic adaptation."""
    if gemini_service is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message
            or "Gemini service is not available. Check installation and GEMINI_API_KEY.",
        )

    limit_token = await _acquire_limit_token(http_request)
    try:
        analysis = await gemini_service.generate_plot_analysis(
            request.story_text, request.num_chapters
        )
        return {"analysis": analysis}
    except GeminiServiceError as e:
        detail = (
            {"message": str(e), "retry_after_seconds": e.retry_after_seconds}
            if e.retry_after_seconds is not None
            else str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        limit_token.release()


@router.post("/character-prompt")
async def generate_character_prompt(
    request: CharacterPromptRequest, http_request: Request
):
    """Generate image prompt for a character."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        prompt = await gemini_service.generate_character_prompts(
            request.character_description
        )
        return {"image_prompt": prompt}
    except GeminiServiceError as e:
        detail = (
            {"message": str(e), "retry_after_seconds": e.retry_after_seconds}
            if e.retry_after_seconds is not None
            else str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        limit_token.release()


@router.post("/panel-script")
async def generate_panel_script(request: PanelScriptRequest, http_request: Request):
    """Generate panel script for a scene."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        script = await gemini_service.generate_panel_script(request.scene_description)
        return {"panel_script": script}
    except GeminiServiceError as e:
        detail = (
            {"message": str(e), "retry_after_seconds": e.retry_after_seconds}
            if e.retry_after_seconds is not None
            else str(e)
        )
        raise HTTPException(status_code=e.status_code, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        limit_token.release()


@router.get("/health")
async def health_check():
    """Check if Gemini API is configured."""
    if gemini_service is None:
        return {
            "status": "unconfigured",
            "message": gemini_error_message,
        }
    return {"status": "configured"}

