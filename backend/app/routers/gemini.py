"""API routes for Gemini-based text generation and analysis."""
import base64
import io
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from app.config import settings
from app.crypto_utils import decrypt_secret
from app.deps import get_current_user_optional
from app.providers import TEXT_GEN_PROVIDERS
from app.rate_limit import PerUserRateLimiter, QueueFullError, RateLimitExceededError
from app.services import GeminiService, GeminiServiceError
from app.schemas import (
    ComposePageRequest, ComposePageResponse,
    AutoLayoutRequest, AutoLayoutResponse,
    LayoutDimensionsRequest, LayoutDimensionsResponse, PanelCellDimensions,
)

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
    stream: bool = False


class StoryAnalysisRequest(BaseModel):
    """Request model for story analysis."""

    story_text: str
    num_chapters: int = 3
    desired_main_characters: int = 5
    target_total_pages: str = "auto"
    genre_tone: str = "Shonen action"
    art_style_reference: str = "classic black-and-white weekly shonen"
    max_panels_per_page: int = 6
    special_requests: str = "None"
    stream: bool = False


class StructuredStoryAnalysisRequest(StoryAnalysisRequest):
    """Request model for story analysis with API-generated JSON snapshot."""

    project_id: str = "manga_project_001"
    stream: bool = False


class Step2DesignRequest(BaseModel):
    """Request model for Step 2 character design generation."""

    project_id: str = "manga_project_001"
    step1_json: dict
    desired_main_characters: int = 5
    genre_tone: str = "Shonen action"
    art_style_reference: str = "classic black-and-white weekly shonen"
    special_requests: str = "None"
    stream: bool = False


class Step3ScriptRequest(BaseModel):
    """Request model for Step 3 panel script generation."""

    project_id: str = "manga_project_001"
    step1_json: dict
    step2_json: dict
    num_chapters: int = 3
    target_total_pages: str = "auto"
    genre_tone: str = "Shonen action"
    art_style_reference: str = "classic black-and-white weekly shonen"
    max_panels_per_page: int = 6
    special_requests: str = "None"
    stream: bool = False


class CharacterPromptRequest(BaseModel):
    """Request model for character prompt generation."""

    character_description: str


class PanelScriptRequest(BaseModel):
    """Request model for panel script generation."""

    scene_description: str


class PanelImageRequest(BaseModel):
    """Request model for Step 4 panel image generation."""

    image_prompt: str
    width: int = 720
    height: int = 960


class AdaptStoryRequest(BaseModel):
    """Request model for AI story adaptation."""

    original_story: str
    creative_direction: str
    genre_tone: str = "Fantasy/Adventure"
    art_style_reference: str = "manga"
    special_requests: str = "None"


def _resolve_user_key(request: Request) -> str:
    header_user_id = request.headers.get("x-user-id")
    if header_user_id:
        return f"user:{header_user_id[:64]}"

    client_host = request.client.host if request.client else "anonymous"
    return f"ip:{client_host}"


async def _resolve_gemini_service(http_request: Request) -> GeminiService | None:
    """Resolve the GeminiService for this request: the logged-in user's BYOK/model
    override if configured, otherwise the shared default singleton."""
    user = await get_current_user_optional(http_request)
    if user:
        cfg = user.get("text_gen_config")
        if cfg:
            mode = cfg.get("mode")
            if mode == "byok":
                provider_info = TEXT_GEN_PROVIDERS.get(cfg.get("provider", ""))
                if provider_info:
                    try:
                        return GeminiService(
                            override_url=provider_info["api_url"],
                            override_api_key=decrypt_secret(cfg.get("api_key_encrypted", "")) or None,
                            override_model=provider_info["model"],
                        )
                    except ValueError:
                        pass
            elif mode == "local_server" and cfg.get("api_url"):
                try:
                    return GeminiService(
                        override_url=cfg["api_url"],
                        override_api_key=None,
                        override_model=cfg.get("model") or None,
                    )
                except ValueError:
                    pass
            elif mode == "nine_router" and cfg.get("model"):
                try:
                    return GeminiService(override_model=cfg["model"])
                except (ValueError, ImportError):
                    pass
    return gemini_service


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
    """Generate text using Gemini API with optional streaming."""
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    try:
        if request.stream:
            async def stream_generator():
                try:
                    async for chunk in await svc.generate_text(request.prompt, stream=True):
                        yield f"data: {chunk}\n\n"
                    yield "data: [DONE]\n\n"
                except GeminiServiceError as e:
                    error_data = {
                        "error": str(e),
                        "status_code": e.status_code,
                    }
                    if e.retry_after_seconds is not None:
                        error_data["retry_after_seconds"] = e.retry_after_seconds
                    yield f"data: {error_data}\n\n"
                except Exception as e:
                    yield f"data: {{'error': '{str(e)}'}}\n\n"
                finally:
                    limit_token.release()

            return StreamingResponse(
                stream_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
            )
        else:
            result = await svc.generate_text(request.prompt, stream=False)
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
        if not request.stream:
            limit_token.release()


@router.post("/analyze-story")
async def analyze_story(request: StoryAnalysisRequest, http_request: Request):
    """Analyze a story for comic adaptation."""
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message
            or "Gemini service is not available. Check installation and GEMINI_API_KEY.",
        )

    limit_token = await _acquire_limit_token(http_request)
    try:
        analysis = await svc.generate_plot_analysis(
            story_text=request.story_text,
            num_chapters=request.num_chapters,
            desired_main_characters=request.desired_main_characters,
            target_total_pages=request.target_total_pages,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            max_panels_per_page=request.max_panels_per_page,
            special_requests=request.special_requests,
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


@router.post("/analyze-story-structured")
async def analyze_story_structured(
    request: StructuredStoryAnalysisRequest, http_request: Request
):
    """
    Analyze Step 1 and return markdown analysis + structured JSON snapshot.

    When request.stream is True (default for the frontend) the response is an
    SSE stream:
      data: {"type":"token","content":"..."}   — markdown token (show to user)
      data: {"type":"done","analysis":"...","structured_json":{...}}  — final result
      data: {"type":"error","message":"...","status_code":N}          — on failure

    The entire pipeline runs in a single LLM call, so there is no silent gap
    that could trigger a Cloudflare 524 timeout.
    """
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message
            or "Gemini service is not available. Check installation and GEMINI_API_KEY.",
        )

    limit_token = await _acquire_limit_token(http_request)

    if request.stream:
        import json as _json

        async def sse_generator():
            try:
                last_updated = datetime.now(timezone.utc).isoformat()
                async for event in svc.generate_step1_stream(
                    project_id=request.project_id,
                    story_text=request.story_text,
                    num_chapters=request.num_chapters,
                    desired_main_characters=request.desired_main_characters,
                    target_total_pages=request.target_total_pages,
                    genre_tone=request.genre_tone,
                    art_style_reference=request.art_style_reference,
                    max_panels_per_page=request.max_panels_per_page,
                    special_requests=request.special_requests,
                    step_status="review_pending",
                    last_updated=last_updated,
                ):
                    kind = event[0]
                    if kind == "token":
                        yield "data: " + _json.dumps({"type": "token", "content": event[1]}) + "\n\n"
                    elif kind == "done":
                        yield "data: " + _json.dumps({
                            "type": "done",
                            "analysis": event[1],
                            "structured_json": event[2],
                        }) + "\n\n"
                    elif kind == "error":
                        yield "data: " + _json.dumps({
                            "type": "error",
                            "message": event[1],
                            "status_code": event[2] if len(event) > 2 else 500,
                        }) + "\n\n"
            except GeminiServiceError as exc:
                detail = {"message": str(exc), "status_code": exc.status_code}
                if exc.retry_after_seconds is not None:
                    detail["retry_after_seconds"] = exc.retry_after_seconds
                yield "data: " + _json.dumps({"type": "error", **detail}) + "\n\n"
            except Exception as exc:
                yield "data: " + _json.dumps({"type": "error", "message": str(exc), "status_code": 500}) + "\n\n"
            finally:
                limit_token.release()

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming fallback (kept for direct API / curl usage)
    try:
        last_updated = datetime.now(timezone.utc).isoformat()
        analysis_markdown, structured_json = await svc.generate_step1_combined(
            project_id=request.project_id,
            story_text=request.story_text,
            num_chapters=request.num_chapters,
            desired_main_characters=request.desired_main_characters,
            target_total_pages=request.target_total_pages,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            max_panels_per_page=request.max_panels_per_page,
            special_requests=request.special_requests,
            step_status="review_pending",
            last_updated=last_updated,
        )
        return {"analysis": analysis_markdown, "structured_json": structured_json}
    except GeminiServiceError as exc:
        detail = (
            {"message": str(exc), "retry_after_seconds": exc.retry_after_seconds}
            if exc.retry_after_seconds is not None
            else str(exc)
        )
        raise HTTPException(status_code=exc.status_code, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        limit_token.release()


class LightweightAnalysisRequest(BaseModel):
    """Minimal request for Story Setup preview analysis."""
    story_text: str
    genre_tone: str = "Adventure"


@router.post("/analyze-story-lightweight")
async def analyze_story_lightweight(request: LightweightAnalysisRequest, http_request: Request):
    """
    Lightweight analysis for Story Setup preview (characters, beats, tone).
    Much faster than analyze-story-structured — no chapter breakdown.

    SSE stream events:
      data: {"type":"token","content":"..."}
      data: {"type":"done","result":{...}}
      data: {"type":"error","message":"...","status_code":N}
    """
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message or "Gemini service is not available.",
        )

    limit_token = await _acquire_limit_token(http_request)

    import json as _json

    async def sse_generator():
        try:
            async for event in svc.analyze_story_lightweight_stream(
                story_text=request.story_text,
                genre_tone=request.genre_tone,
            ):
                kind = event[0]
                if kind == "token":
                    yield "data: " + _json.dumps({"type": "token", "content": event[1]}) + "\n\n"
                elif kind == "done":
                    yield "data: " + _json.dumps({"type": "done", "result": event[1]}) + "\n\n"
                elif kind == "error":
                    yield "data: " + _json.dumps({
                        "type": "error",
                        "message": event[1],
                        "status_code": event[2] if len(event) > 2 else 500,
                    }) + "\n\n"
        except GeminiServiceError as exc:
            detail = {"message": str(exc), "status_code": exc.status_code}
            if exc.retry_after_seconds is not None:
                detail["retry_after_seconds"] = exc.retry_after_seconds
            yield "data: " + _json.dumps({"type": "error", **detail}) + "\n\n"
        except Exception as exc:
            yield "data: " + _json.dumps({"type": "error", "message": str(exc), "status_code": 500}) + "\n\n"
        finally:
            limit_token.release()

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/adapt-story")
async def adapt_story(request: AdaptStoryRequest, http_request: Request):
    """
    Adapt a story based on user's creative direction using a Comic Scriptwriter persona.

    SSE stream events:
      data: {"type":"thinking","content":"..."}           — reasoning tokens
      data: {"type":"done","adapted_story":"...","changes_summary":[...]}
      data: {"type":"error","message":"...","status_code":N}
    """
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    import json as _json

    async def sse_generator():
        try:
            async for event in svc.generate_adapt_story_stream(
                original_story=request.original_story,
                creative_direction=request.creative_direction,
                genre_tone=request.genre_tone,
                art_style_reference=request.art_style_reference,
                special_requests=request.special_requests,
            ):
                kind = event[0]
                if kind == "thinking":
                    yield "data: " + _json.dumps({"type": "thinking", "content": event[1]}) + "\n\n"
                elif kind == "done":
                    yield "data: " + _json.dumps({
                        "type": "done",
                        "adapted_story": event[1],
                        "changes_summary": event[2],
                    }) + "\n\n"
                elif kind == "error":
                    yield "data: " + _json.dumps({
                        "type": "error",
                        "message": event[1],
                        "status_code": event[2] if len(event) > 2 else 500,
                    }) + "\n\n"
        except GeminiServiceError as exc:
            detail: dict = {"message": str(exc), "status_code": exc.status_code}
            if exc.retry_after_seconds is not None:
                detail["retry_after_seconds"] = exc.retry_after_seconds
            yield "data: " + _json.dumps({"type": "error", **detail}) + "\n\n"
        except Exception as exc:
            yield "data: " + _json.dumps({"type": "error", "message": str(exc), "status_code": 500}) + "\n\n"
        finally:
            limit_token.release()

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/character-prompt")
async def generate_character_prompt(
    request: CharacterPromptRequest, http_request: Request
):
    """Generate image prompt for a character."""
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        prompt = await svc.generate_character_prompts(
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


@router.post("/character-designs-structured")
async def generate_character_designs_structured(
    request: Step2DesignRequest, http_request: Request
):
    """
    Generate Step 2 character design markdown + structured JSON.
    Streams when request.stream=True (SSE events: token / done / error).
    """
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    if request.stream:
        import json as _json

        async def sse_generator():
            try:
                last_updated = datetime.now(timezone.utc).isoformat()
                async for event in svc.generate_step2_stream(
                    project_id=request.project_id,
                    step1_json=request.step1_json,
                    desired_main_characters=request.desired_main_characters,
                    genre_tone=request.genre_tone,
                    art_style_reference=request.art_style_reference,
                    special_requests=request.special_requests,
                    step_status="review_pending",
                    last_updated=last_updated,
                ):
                    kind = event[0]
                    if kind == "token":
                        yield "data: " + _json.dumps({"type": "token", "content": event[1]}) + "\n\n"
                    elif kind == "done":
                        yield "data: " + _json.dumps({
                            "type": "done",
                            "design_markdown": event[1],
                            "structured_json": event[2],
                        }) + "\n\n"
                    elif kind == "error":
                        yield "data: " + _json.dumps({
                            "type": "error",
                            "message": event[1],
                            "status_code": event[2] if len(event) > 2 else 500,
                        }) + "\n\n"
            except GeminiServiceError as exc:
                detail = {"message": str(exc), "status_code": exc.status_code}
                if exc.retry_after_seconds is not None:
                    detail["retry_after_seconds"] = exc.retry_after_seconds
                yield "data: " + _json.dumps({"type": "error", **detail}) + "\n\n"
            except Exception as exc:
                yield "data: " + _json.dumps({"type": "error", "message": str(exc), "status_code": 500}) + "\n\n"
            finally:
                limit_token.release()

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    try:
        last_updated = datetime.now(timezone.utc).isoformat()
        design_markdown = await svc.generate_step2_character_design_markdown(
            step1_json=request.step1_json,
            desired_main_characters=request.desired_main_characters,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            special_requests=request.special_requests,
        )
        structured_json = await svc.generate_step2_structured_snapshot(
            project_id=request.project_id,
            step1_json=request.step1_json,
            desired_main_characters=request.desired_main_characters,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            special_requests=request.special_requests,
            step_status="review_pending",
            last_updated=last_updated,
            design_markdown=design_markdown,
        )
        return {"design_markdown": design_markdown, "structured_json": structured_json}
    except GeminiServiceError as exc:
        detail = (
            {"message": str(exc), "retry_after_seconds": exc.retry_after_seconds}
            if exc.retry_after_seconds is not None else str(exc)
        )
        raise HTTPException(status_code=exc.status_code, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        limit_token.release()


@router.post("/panel-script")
async def generate_panel_script(request: PanelScriptRequest, http_request: Request):
    """Generate panel script for a scene."""
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        script = await svc.generate_panel_script(request.scene_description)
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


@router.post("/panel-script-structured")
async def generate_panel_script_structured(
    request: Step3ScriptRequest, http_request: Request
):
    """
    Generate Step 3 panel script markdown + structured JSON.
    Streams when request.stream=True (SSE events: token / done / error).
    """
    svc = await _resolve_gemini_service(http_request)
    if svc is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    if request.stream:
        import json as _json

        async def sse_generator():
            try:
                last_updated = datetime.now(timezone.utc).isoformat()
                async for event in svc.generate_step3_stream(
                    project_id=request.project_id,
                    step1_json=request.step1_json,
                    step2_json=request.step2_json,
                    num_chapters=request.num_chapters,
                    target_total_pages=request.target_total_pages,
                    genre_tone=request.genre_tone,
                    art_style_reference=request.art_style_reference,
                    max_panels_per_page=request.max_panels_per_page,
                    special_requests=request.special_requests,
                    step_status="review_pending",
                    last_updated=last_updated,
                ):
                    kind = event[0]
                    if kind == "token":
                        yield "data: " + _json.dumps({"type": "token", "content": event[1]}) + "\n\n"
                    elif kind == "done":
                        yield "data: " + _json.dumps({
                            "type": "done",
                            "script_markdown": event[1],
                            "structured_json": event[2],
                        }) + "\n\n"
                    elif kind == "error":
                        yield "data: " + _json.dumps({
                            "type": "error",
                            "message": event[1],
                            "status_code": event[2] if len(event) > 2 else 500,
                        }) + "\n\n"
            except GeminiServiceError as exc:
                detail = {"message": str(exc), "status_code": exc.status_code}
                if exc.retry_after_seconds is not None:
                    detail["retry_after_seconds"] = exc.retry_after_seconds
                yield "data: " + _json.dumps({"type": "error", **detail}) + "\n\n"
            except Exception as exc:
                yield "data: " + _json.dumps({"type": "error", "message": str(exc), "status_code": 500}) + "\n\n"
            finally:
                limit_token.release()

        return StreamingResponse(
            sse_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    try:
        last_updated = datetime.now(timezone.utc).isoformat()
        script_markdown = await svc.generate_step3_panel_script_markdown(
            step1_json=request.step1_json,
            step2_json=request.step2_json,
            num_chapters=request.num_chapters,
            target_total_pages=request.target_total_pages,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            max_panels_per_page=request.max_panels_per_page,
            special_requests=request.special_requests,
        )
        structured_json = await svc.generate_step3_structured_snapshot(
            project_id=request.project_id,
            step2_json=request.step2_json,
            num_chapters=request.num_chapters,
            target_total_pages=request.target_total_pages,
            genre_tone=request.genre_tone,
            art_style_reference=request.art_style_reference,
            max_panels_per_page=request.max_panels_per_page,
            special_requests=request.special_requests,
            step_status="review_pending",
            last_updated=last_updated,
            script_markdown=script_markdown,
        )
        return {"script_markdown": script_markdown, "structured_json": structured_json}
    except GeminiServiceError as exc:
        detail = (
            {"message": str(exc), "retry_after_seconds": exc.retry_after_seconds}
            if exc.retry_after_seconds is not None else str(exc)
        )
        raise HTTPException(status_code=exc.status_code, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        limit_token.release()


@router.post("/generate-panel-image")
async def generate_panel_image(request: PanelImageRequest, http_request: Request):
    """Generate a panel image URL from prompt via backend endpoint."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)
    try:
        image_url = await gemini_service.generate_panel_image_url(
            image_prompt=request.image_prompt,
            width=request.width,
            height=request.height,
        )
        image_data_url = await gemini_service.generate_panel_image_data_url(image_url)
        return {
            "image_url": image_url,
            "image_data_url": image_data_url,
        }
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


@router.post("/layout-dimensions", response_model=LayoutDimensionsResponse)
async def get_layout_dimensions(req: LayoutDimensionsRequest):
    """
    Compute exact pixel cell dimensions for each panel in the chosen layout template.
    Pure arithmetic — no Gemini call, no rate limiting. Use before image generation so
    each panel image is generated at its exact cell size (eliminates content cropping).
    """
    from app.comic_composer import (
        LAYOUT_TEMPLATES,
        compute_layout_cell_dimensions,
        rule_based_layout,
    )

    panels_dicts = [
        {"panel_number": p.panel_number, "shot_type": p.shot_type}
        for p in req.panels
    ]
    n = len(panels_dicts)
    templates = LAYOUT_TEMPLATES.get(n)

    if not templates or req.layout_name == "auto":
        layout, layout_name = rule_based_layout(panels_dicts)
    elif req.layout_name in templates:
        layout, layout_name = templates[req.layout_name], req.layout_name
    else:
        layout, layout_name = rule_based_layout(panels_dicts)

    shot_types = [p.shot_type for p in req.panels]
    raw_dims = compute_layout_cell_dimensions(layout, shot_types, req.style)

    return LayoutDimensionsResponse(
        status="success",
        layout_name=layout_name,
        layout=layout,
        dimensions=[
            PanelCellDimensions(
                panel_index=d["panel_index"],
                panel_number=req.panels[d["panel_index"]].panel_number,
                width=d["width"],
                height=d["height"],
            )
            for d in raw_dims
        ],
    )


async def _suggest_layout(panels_data: list[dict]) -> tuple[list[list[int]], str]:
    """
    Use Gemini to pick the best layout template for this set of panels.
    Falls back to rule-based selection on any error.
    Returns (layout, template_name).
    """
    from app.comic_composer import LAYOUT_TEMPLATES, LAYOUT_DISPLAY_NAMES, rule_based_layout

    n = len(panels_data)
    templates = LAYOUT_TEMPLATES.get(n)
    if not templates or gemini_service is None:
        return rule_based_layout(panels_data)

    panel_desc = "\n".join(
        f"  Panel {p['panel_number']}: {p.get('shot_type', 'medium shot')}"
        + (f" — \"{p['dialogue'][:60]}\"" if p.get("dialogue") else "")
        for p in panels_data
    )
    options = "\n".join(
        f"  \"{name}\": {LAYOUT_DISPLAY_NAMES.get(name, name)}"
        for name in templates
    )

    prompt = (
        f"You are a manga layout artist. Arrange {n} panels into the most dynamic page.\n\n"
        f"Panels:\n{panel_desc}\n\n"
        f"Available layouts:\n{options}\n\n"
        "Rules:\n"
        "- Splash/wide shots deserve full-width rows\n"
        "- Close-ups and inserts can share a row side-by-side\n"
        "- Vary the layout to create visual rhythm\n"
        "- Action climaxes benefit from larger panels\n\n"
        'Respond ONLY with valid JSON: {"template": "<template_name>", "rationale": "<one sentence>"}'
    )

    try:
        result = await gemini_service.generate_text(prompt, stream=False)
        import json, re
        match = re.search(r'\{[^}]+\}', result, re.DOTALL)
        if match:
            data = json.loads(match.group())
            chosen = data.get("template", "").strip()
            if chosen in templates:
                return templates[chosen], chosen
    except Exception:
        pass

    return rule_based_layout(panels_data)


@router.post("/compose-page", response_model=ComposePageResponse)
async def compose_page(req: ComposePageRequest):
    """
    Compose panel images into a single comic page using Pillow layout engine.
    Accepts base64 data URLs per panel; returns a 1200×1600 PNG as base64.
    Set use_smart_layout=true to let Gemini pick the best layout template.
    """
    try:
        from app.comic_composer import compose_page as _compose, LAYOUT_DISPLAY_NAMES
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow is not installed. Run: pip install Pillow>=10.0.0")

    if not req.panels:
        raise HTTPException(status_code=422, detail="At least one panel is required.")

    panels_data = [
        {
            "panel_number": p.panel_number,
            "shot_type": p.shot_type,
            "dialogue": p.dialogue,
            "image_data_url": p.image_data_url,
        }
        for p in req.panels
    ]

    if req.use_smart_layout:
        layout, layout_name = await _suggest_layout(panels_data)
    elif req.layout is not None:
        layout, layout_name = req.layout, "custom"
    else:
        layout, layout_name = None, "stacked"

    # Convert cross_panel_bubbles from Pydantic models to plain dicts
    cross_bubbles = (
        [b.model_dump() for b in req.cross_panel_bubbles]
        if req.cross_panel_bubbles
        else None
    )

    try:
        page_img = _compose(
            panels_data,
            style=req.style,
            layout=layout,
            cross_panel_bubbles=cross_bubbles,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Composition failed: {e}")

    buf = io.BytesIO()
    page_img.save(buf, format="PNG", optimize=True)
    page_b64 = base64.b64encode(buf.getvalue()).decode()

    return ComposePageResponse(
        status="success",
        page_base64=page_b64,
        page_width=page_img.width,
        page_height=page_img.height,
        panel_count=len(req.panels),
        layout_name=LAYOUT_DISPLAY_NAMES.get(layout_name, layout_name),
    )


@router.post("/auto-layout", response_model=AutoLayoutResponse)
async def auto_layout(req: AutoLayoutRequest):
    """
    Split a full AI-generated comic page into individual panels, then
    re-compose them with smart intensity-based layout derived from shot_type.

    Flow: decode page image → detect gutter lines → crop panels →
          suggest layout via Gemini → re-compose with comic_composer.
    """
    try:
        from app.panel_splitter import split_panels
        from app.comic_composer import compose_page as _compose, _decode_image
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Missing dependency: {e}")

    if not req.panels:
        raise HTTPException(status_code=422, detail="At least one panel is required.")

    try:
        page_img = _decode_image(req.page_image_data_url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode page image: {e}")

    n = len(req.panels)
    try:
        cropped = split_panels(page_img, n)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Panel splitting failed: {e}")

    detected = len(cropped)

    # Encode cropped panels back to data URLs and pair with metadata
    panels_data: list[dict] = []
    for i, panel_meta in enumerate(sorted(req.panels, key=lambda p: p.panel_number)):
        panel_img = cropped[i] if i < len(cropped) else page_img
        buf = io.BytesIO()
        panel_img.save(buf, format="PNG")
        data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        panels_data.append({
            "panel_number": panel_meta.panel_number,
            "shot_type": panel_meta.shot_type,
            "dialogue": panel_meta.dialogue,
            "image_data_url": data_url,
        })

    layout, _layout_name = await _suggest_layout(panels_data)

    try:
        composed = _compose(panels_data, style=req.style, layout=layout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Composition failed: {e}")

    out_buf = io.BytesIO()
    composed.save(out_buf, format="PNG", optimize=True)
    page_b64 = base64.b64encode(out_buf.getvalue()).decode()

    return AutoLayoutResponse(
        status="success",
        page_base64=page_b64,
        page_width=composed.width,
        page_height=composed.height,
        panel_count=n,
        detected_panels=detected,
    )

