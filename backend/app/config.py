from pydantic_settings import BaseSettings
from typing import List


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

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

