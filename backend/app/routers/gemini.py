"""
API routes for Gemini-based text generation and analysis.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import GeminiService

router = APIRouter(prefix="/gemini", tags=["gemini"])

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


@router.post("/generate-text")
async def generate_text(request: TextGenerationRequest):
    """Generate text using Gemini API."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    try:
        result = await gemini_service.generate_text(request.prompt)
        return {"generated_text": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-story")
async def analyze_story(request: StoryAnalysisRequest):
    """Analyze a story for comic adaptation."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    try:
        analysis = await gemini_service.generate_plot_analysis(
            request.story_text, request.num_chapters
        )
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/character-prompt")
async def generate_character_prompt(request: CharacterPromptRequest):
    """Generate image prompt for a character."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    try:
        prompt = await gemini_service.generate_character_prompts(
            request.character_description
        )
        return {"image_prompt": prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/panel-script")
async def generate_panel_script(request: PanelScriptRequest):
    """Generate panel script for a scene."""
    if gemini_service is None:
        raise HTTPException(status_code=500, detail=gemini_error_message)

    try:
        script = await gemini_service.generate_panel_script(request.scene_description)
        return {"panel_script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check if Gemini API is configured."""
    if gemini_service is None:
        return {
            "status": "unconfigured",
            "message": gemini_error_message,
        }
    return {"status": "configured"}

