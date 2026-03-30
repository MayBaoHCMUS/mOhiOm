from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import mongo_db
from app.routers import items, gemini, text_to_comic

app = FastAPI(title="mOhiOm Backend", version="0.1.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(items.router, prefix=settings.API_PREFIX)
app.include_router(gemini.router, prefix=settings.API_PREFIX)
app.include_router(text_to_comic.router, prefix=settings.API_PREFIX)


@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup."""
    mongo_db.connect()


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection on shutdown."""
    mongo_db.disconnect()


@app.get("/")
async def root():
    return {"message": "Welcome to mOhiOm Backend API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

