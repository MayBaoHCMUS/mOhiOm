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

    async def generate_plot_analysis(self, story_text: str, num_chapters: int = 3) -> str:
        """
        Generate detailed plot analysis for story division.

        Args:
            story_text: The story to analyze
            num_chapters: Number of chapters to divide into

        Returns:
            Plot analysis and chapter breakdown
        """
        prompt = f"""
Analyze this story and divide it into {num_chapters} chapters for manga adaptation:

{story_text}

For each chapter, provide:
1. Chapter title
2. Page estimate
3. Key scenes
4. Character development
5. Cliffhangers or transitions
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
