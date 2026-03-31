"""Gemini API service for text generation and analysis."""

import re

# google-genai is optional at import time so the app can start without it;
# we surface a clear error when the service is instantiated.
try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.api_core import exceptions as google_exceptions
    genai_import_error = None
except ModuleNotFoundError as exc:  # pragma: no cover - environment dependent
    genai = None
    genai_errors = None
    google_exceptions = None
    genai_import_error = exc

from app.config import settings


class GeminiServiceError(Exception):
    """Gemini service error with an HTTP status code."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        retry_after_seconds: float | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


def _extract_retry_after_seconds(error_text: str) -> float | None:
    """Extract retry delay from Gemini error text when present."""
    if not error_text:
        return None

    decimal_match = re.search(r"Please retry in\s+([0-9]+(?:\.[0-9]+)?)s", error_text)
    if decimal_match:
        return float(decimal_match.group(1))

    seconds_match = re.search(r"'retryDelay':\s*'([0-9]+)s'", error_text)
    if seconds_match:
        return float(seconds_match.group(1))

    return None


class GeminiService:
    """Service class for interacting with Google's Gemini API."""

    def __init__(self, model: str | None = None):
        """Initialize Gemini API with API key from settings."""
        if genai is None:
            raise ImportError(
                "google-genai is not installed. Run `pip install google-genai`."
            ) from genai_import_error
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set")

        self.model_name = model or settings.GEMINI_MODEL
        # Client-based SDK surface; avoids global state.
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def generate_text(self, prompt: str) -> str:
        """
        Generate text using Gemini API.

        Args:
            prompt: The input prompt for text generation

        Returns:
            Generated text response
        """
        try:
            response = self.client.models.generate_content(
                model=self.model_name, contents=prompt
            )
            return response.text
        except google_exceptions.ResourceExhausted as exc:
            retry_after = _extract_retry_after_seconds(str(exc))
            raise GeminiServiceError(
                "Gemini quota exceeded. Please retry later or check your billing/limits.",
                status_code=429,
                retry_after_seconds=retry_after,
            ) from exc
        except google_exceptions.NotFound as exc:
            raise GeminiServiceError(
                f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                status_code=404,
            ) from exc
        except genai_errors.ClientError as exc:
            status_code = int(getattr(exc, "code", 500) or 500)
            retry_after = _extract_retry_after_seconds(str(exc))
            if status_code == 429:
                raise GeminiServiceError(
                    "Gemini quota exceeded. Please retry later or check your billing/limits.",
                    status_code=429,
                    retry_after_seconds=retry_after,
                ) from exc
            if status_code == 404:
                raise GeminiServiceError(
                    f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                    status_code=404,
                ) from exc
            raise GeminiServiceError(
                f"Gemini API request failed: {exc}", status_code=status_code
            ) from exc
        except Exception as exc:
            raise GeminiServiceError(f"Failed to generate text: {exc}") from exc

    async def analyze_story(self, story_text: str) -> str:
        """
        Analyze a story for comic adaptation.

        Args:
            story_text: The story text to analyze

        Returns:
            Analysis of the story
        """
        prompt = f"""
Please analyze the following story for comic/manga adaptation:

{story_text}

Provide a detailed analysis including:
1. Main plot points
2. Character development arcs
3. Recommended pacing for comic panels
4. Key scenes for visual adaptation
5. Suggested art style considerations
        """
        return await self.generate_text(prompt)

    async def generate_plot_analysis(
        self,
        story_text: str,
        num_chapters: int = 3,
        desired_main_characters: int = 5,
        target_total_pages: str = "auto",
        genre_tone: str = "Shonen action",
        art_style_reference: str = "classic black-and-white weekly shonen",
        max_panels_per_page: int = 6,
        special_requests: str = "None",
    ) -> str:
        """
        Generate detailed plot analysis for story division.

        Args:
            story_text: The story to analyze
            num_chapters: Number of chapters to divide into

        Returns:
            Plot analysis and chapter breakdown
        """
        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 1: Analysis & Planning. Never generate images or dialogue yet - only the structured plan.

USER CUSTOMIZATION INPUTS:

Story text: '''{story_text}'''
Desired total main characters: {desired_main_characters} (example: 5) -> If the story has more, you MUST suggest smart merges or which characters to keep/promote.
Number of chapters the manga should have: {num_chapters} (example: 8)
Target total pages for the whole manga: {target_total_pages} (example: 120 or auto)
Preferred manga genre & tone: {genre_tone}
Art style reference (optional): {art_style_reference}
Maximum panels per page allowed: {max_panels_per_page} (default 6-8; you can change to 4 for dramatic pacing)
Any special requests: {special_requests}

TASK - STEP 1 ONLY
Read the story and output EXACTLY in this order using clean markdown:

1. Character Breakdown

Total characters detected: __
Main characters (exactly the number the user requested): list them with 1-sentence role + personality + suggested visual design hook.
Supporting / minor characters (grouped or merged if needed to respect the user limit).
Any characters you recommend removing or combining and why.

2. Plot & Arc Analysis

Main plot in one sentence.
Number of major plot arcs.
Subplots (list each with importance level: High / Medium / Low).
Overall story structure (3-act or 4-act) and how it will be divided into the exact number of chapters the user wants.

3. Chapter Division
Create exactly {num_chapters} chapters.
For each chapter:

Chapter title (creative manga-style title)
Chapters covered pages estimate (so total matches user's target pages)
List of scenes inside this chapter (numbered)

4. Scene-by-Scene Breakdown (the most important part)
For every single scene across all chapters:

Scene number & chapter it belongs to
One-sentence summary
Key emotional/visual moment (what must be shown big)
Suggested number of pages this scene needs (1-4 pages)
Suggested number of panels on each of those pages (example: Page 1: 6 panels, Page 2: splash + 3 panels)
Panel layout notes (e.g. "double-page spread for the betrayal", "vertical 4-panel strip for tension", "cinematic wide panel for city reveal", etc.)
Whether this scene needs a splash page or double-page spread

5. Global Manga Layout Rules You Will Follow Later

Average panels per page for normal scenes
How many full splash pages you plan
Pacing rhythm (e.g. "Chapter 1: fast 5-7 panels/page, Chapter 4 climax: slower 3-4 panels/page")
Any recurring visual motifs or page tricks you will use

6. Final Statistics Summary (in a boxed table)

Total chapters: __
Total scenes: __
Total estimated pages: __
Main characters used: __
Average scenes per page across the whole manga: __
Number of splash/double pages: __

After you output everything above, end with this exact line:
"Step 1 complete. Reply with 'Proceed to Step 2 - Character Designs' if you want me to create full character sheets, or tell me any changes you want to the plan first."
        """
        return await self.generate_text(prompt)

    async def generate_character_prompts(self, character_description: str) -> str:
        """
        Generate AI image prompts for a character.

        Args:
            character_description: Description of the character

        Returns:
            Image generation prompt
        """
        prompt = f"""
Create a detailed image generation prompt for this manga/anime character:

{character_description}

The prompt should include:
1. Character appearance details
2. Clothing and accessories
3. Pose suggestion
4. Art style specifications
5. Emotional expression
        """
        return await self.generate_text(prompt)

    async def generate_panel_script(self, scene_description: str) -> str:
        """
        Generate detailed panel scripts for a scene.

        Args:
            scene_description: Description of the scene

        Returns:
            Detailed panel breakdown
        """
        prompt = f"""
Create a detailed manga panel script for this scene:

{scene_description}

Include:
1. Panel layout (number and arrangement)
2. Each panel's visual description
3. Dialogue and thoughts
4. Action sequences
5. Visual effects and emphasis
        """
        return await self.generate_text(prompt)
