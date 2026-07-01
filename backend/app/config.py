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

    # 9Router (optional text generation provider)
    NINE_ROUTER_URL: str = ""
    NINE_ROUTER_API_KEY: str = ""
    NINE_ROUTER_MODEL: str = "kr/claude-sonnet-4.5"
    NINE_ROUTER_TIMEOUT_SECONDS: float = 60.0
    # Comma-separated list of models users can switch between in "nine_router" BYOK mode.
    # Falls back to [NINE_ROUTER_MODEL] when blank.
    NINE_ROUTER_AVAILABLE_MODELS: str = ""

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # Auth
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60 * 24

    AUTH_COOKIE_NAME: str = "mohiom_access_token"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None

    AUTH_FRONTEND_URL: str = "http://localhost:3000"
    AUTH_BACKEND_URL: str = "http://localhost:8000"

    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_GITHUB_CLIENT_ID: str = ""
    OAUTH_GITHUB_CLIENT_SECRET: str = ""

    PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: int = 30

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Admin dashboard
    ADMIN_SECRET_KEY: str = "mohiom-admin-2024"

    class Config:
        env_file = ENV_FILE
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
