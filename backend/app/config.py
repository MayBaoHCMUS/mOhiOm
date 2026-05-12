from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

# Resolve the backend root so .env is loaded even when app runs from repo root
BACKEND_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API
    APP_NAME: str = "mOhiOm"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # Database
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "mohiom_db"

    # Gemini API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_REQUESTS_PER_SECOND: int = 2
    GEMINI_MAX_QUEUE_SIZE: int = 8
    GEMINI_MAX_QUEUE_WAIT_SECONDS: float = 8.0

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # Auth
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60 * 24

    AUTH_FRONTEND_URL: str = "http://localhost:3000"
    AUTH_BACKEND_URL: str = "http://localhost:8000"

    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_GITHUB_CLIENT_ID: str = ""
    OAUTH_GITHUB_CLIENT_SECRET: str = ""

    class Config:
        env_file = ENV_FILE
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
