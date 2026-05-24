"""API routes for Gemini-based text generation and analysis."""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone
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
    """Generate text using Gemini API with optional streaming."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    try:
        if request.stream:
            async def stream_generator():
                try:
                    async for chunk in await gemini_service.generate_text(request.prompt, stream=True):
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
            result = await gemini_service.generate_text(request.prompt, stream=False)
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
    if gemini_service is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message
            or "Gemini service is not available. Check installation and GEMINI_API_KEY.",
        )

    limit_token = await _acquire_limit_token(http_request)
    try:
        analysis = await gemini_service.generate_plot_analysis(
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
    """Analyze Step 1 and return both markdown analysis and structured JSON snapshot."""
    if gemini_service is None:
        raise HTTPException(
            status_code=500,
            detail=gemini_error_message
            or "Gemini service is not available. Check installation and GEMINI_API_KEY.",
        )

    limit_token = await _acquire_limit_token(http_request)

    try:
        if request.stream:
            async def stream_generator():
                try:
                    analysis_chunks = []
                    async for chunk in await gemini_service.generate_plot_analysis(
                        story_text=request.story_text,
                        num_chapters=request.num_chapters,
                        desired_main_characters=request.desired_main_characters,
                        target_total_pages=request.target_total_pages,
                        genre_tone=request.genre_tone,
                        art_style_reference=request.art_style_reference,
                        max_panels_per_page=request.max_panels_per_page,
                        special_requests=request.special_requests,
                        stream=True,
                    ):
                        analysis_chunks.append(chunk)
                        yield f"data: {chunk}\n\n"

                    analysis_markdown = "".join(analysis_chunks)
                    last_updated = datetime.now(timezone.utc).isoformat()
                    structured_json = await gemini_service.generate_step1_structured_snapshot(
                        project_id=request.project_id,
                        story_text=request.story_text,
                        num_chapters=request.num_chapters,
                        desired_main_characters=request.desired_main_characters,
                        target_total_pages=request.target_total_pages,
                        genre_tone=request.genre_tone,
                        art_style_reference=request.art_style_reference,
                        max_panels_per_page=request.max_panels_per_page,
                        special_requests=request.special_requests,
                        analysis_markdown=analysis_markdown,
                        step_status="review_pending",
                        last_updated=last_updated,
                    )

                    import json
                    yield f"data: [STRUCTURED_JSON]{json.dumps(structured_json)}\n\n"
                    yield "data: [DONE]\n\n"
                except GeminiServiceError as e:
                    error_data = {"error": str(e), "status_code": e.status_code}
                    if e.retry_after_seconds is not None:
                        error_data["retry_after_seconds"] = e.retry_after_seconds
                    import json
                    yield f"data: {json.dumps(error_data)}\n\n"
                except Exception as e:
                    import json
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
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
            analysis_markdown = await gemini_service.generate_plot_analysis(
                story_text=request.story_text,
                num_chapters=request.num_chapters,
                desired_main_characters=request.desired_main_characters,
                target_total_pages=request.target_total_pages,
                genre_tone=request.genre_tone,
                art_style_reference=request.art_style_reference,
                max_panels_per_page=request.max_panels_per_page,
                special_requests=request.special_requests,
                stream=False,
            )

            last_updated = datetime.now(timezone.utc).isoformat()
            structured_json = await gemini_service.generate_step1_structured_snapshot(
                project_id=request.project_id,
                story_text=request.story_text,
                num_chapters=request.num_chapters,
                desired_main_characters=request.desired_main_characters,
                target_total_pages=request.target_total_pages,
                genre_tone=request.genre_tone,
                art_style_reference=request.art_style_reference,
                max_panels_per_page=request.max_panels_per_page,
                special_requests=request.special_requests,
                analysis_markdown=analysis_markdown,
                step_status="review_pending",
                last_updated=last_updated,
            )

            return {
                "analysis": analysis_markdown,
                "structured_json": structured_json,
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
        if not request.stream:
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


@router.post("/character-designs-structured")
async def generate_character_designs_structured(
    request: Step2DesignRequest, http_request: Request
):
    """Generate Step 2 markdown + structured JSON using Step 1 JSON context."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    try:
        if request.stream:
            async def stream_generator():
                try:
                    design_chunks = []
                    async for chunk in await gemini_service.generate_step2_character_design_markdown(
                        step1_json=request.step1_json,
                        desired_main_characters=request.desired_main_characters,
                        genre_tone=request.genre_tone,
                        art_style_reference=request.art_style_reference,
                        special_requests=request.special_requests,
                        stream=True,
                    ):
                        design_chunks.append(chunk)
                        yield f"data: {chunk}\n\n"

                    design_markdown = "".join(design_chunks)
                    last_updated = datetime.now(timezone.utc).isoformat()
                    structured_json = await gemini_service.generate_step2_structured_snapshot(
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

                    import json
                    yield f"data: [STRUCTURED_JSON]{json.dumps(structured_json)}\n\n"
                    yield "data: [DONE]\n\n"
                except GeminiServiceError as e:
                    error_data = {"error": str(e), "status_code": e.status_code}
                    if e.retry_after_seconds is not None:
                        error_data["retry_after_seconds"] = e.retry_after_seconds
                    import json
                    yield f"data: {json.dumps(error_data)}\n\n"
                except Exception as e:
                    import json
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
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
            design_markdown = await gemini_service.generate_step2_character_design_markdown(
                step1_json=request.step1_json,
                desired_main_characters=request.desired_main_characters,
                genre_tone=request.genre_tone,
                art_style_reference=request.art_style_reference,
                special_requests=request.special_requests,
                stream=False,
            )

            last_updated = datetime.now(timezone.utc).isoformat()
            structured_json = await gemini_service.generate_step2_structured_snapshot(
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

            return {
                "design_markdown": design_markdown,
                "structured_json": structured_json,
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
        if not request.stream:
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


@router.post("/panel-script-structured")
async def generate_panel_script_structured(
    request: Step3ScriptRequest, http_request: Request
):
    """Generate Step 3 markdown + structured JSON using Step 1/2 JSON context."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    limit_token = await _acquire_limit_token(http_request)

    try:
        if request.stream:
            async def stream_generator():
                try:
                    script_chunks = []
                    async for chunk in await gemini_service.generate_step3_panel_script_markdown(
                        step1_json=request.step1_json,
                        step2_json=request.step2_json,
                        num_chapters=request.num_chapters,
                        target_total_pages=request.target_total_pages,
                        genre_tone=request.genre_tone,
                        art_style_reference=request.art_style_reference,
                        max_panels_per_page=request.max_panels_per_page,
                        special_requests=request.special_requests,
                        stream=True,
                    ):
                        script_chunks.append(chunk)
                        yield f"data: {chunk}\n\n"

                    script_markdown = "".join(script_chunks)
                    last_updated = datetime.now(timezone.utc).isoformat()
                    structured_json = await gemini_service.generate_step3_structured_snapshot(
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

                    import json
                    yield f"data: [STRUCTURED_JSON]{json.dumps(structured_json)}\n\n"
                    yield "data: [DONE]\n\n"
                except GeminiServiceError as e:
                    error_data = {"error": str(e), "status_code": e.status_code}
                    if e.retry_after_seconds is not None:
                        error_data["retry_after_seconds"] = e.retry_after_seconds
                    import json
                    yield f"data: {json.dumps(error_data)}\n\n"
                except Exception as e:
                    import json
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
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
            script_markdown = await gemini_service.generate_step3_panel_script_markdown(
                step1_json=request.step1_json,
                step2_json=request.step2_json,
                num_chapters=request.num_chapters,
                target_total_pages=request.target_total_pages,
                genre_tone=request.genre_tone,
                art_style_reference=request.art_style_reference,
                max_panels_per_page=request.max_panels_per_page,
                special_requests=request.special_requests,
                stream=False,
            )

            last_updated = datetime.now(timezone.utc).isoformat()
            structured_json = await gemini_service.generate_step3_structured_snapshot(
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

            return {
                "script_markdown": script_markdown,
                "structured_json": structured_json,
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
        if not request.stream:
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

