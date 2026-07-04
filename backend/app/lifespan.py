"""
Application initialization and startup/shutdown events.
"""

from contextlib import asynccontextmanager
from app.database import mongo_db


@asynccontextmanager
async def lifespan(app):
    """Handle startup and shutdown events."""
    # Startup
    mongo_db.connect()
    yield
    # Shutdown
    mongo_db.disconnect()

