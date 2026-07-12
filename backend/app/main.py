from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import mongo_db
from app.routers import items, text_gen, text_to_comic, auth, projects, gallery, ratings, admin_analytics, analytics, bubbles, comic_generation, onboarding, images, image_gen
from app.routers import settings as settings_router
from app import r2_storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan: startup and shutdown events."""
    # Startup
    mongo_db.connect()
    mongo_db.get_database()["project_images"].create_index(
        [("user_id", 1), ("project_id", 1), ("image_key", 1)],
        unique=True,
        background=True,
    )
    yield
    # Shutdown
    mongo_db.disconnect()


app = FastAPI(title="mOhiOm Backend", version="0.1.0", lifespan=lifespan)

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
app.include_router(text_gen.router, prefix=settings.API_PREFIX)
app.include_router(text_to_comic.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX)
app.include_router(gallery.router, prefix=settings.API_PREFIX)
app.include_router(ratings.router, prefix=settings.API_PREFIX)
app.include_router(admin_analytics.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)
app.include_router(bubbles.router, prefix=settings.API_PREFIX)
app.include_router(comic_generation.router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)
app.include_router(onboarding.router, prefix=settings.API_PREFIX)
app.include_router(images.router, prefix=settings.API_PREFIX)
app.include_router(image_gen.router, prefix=settings.API_PREFIX)



@app.get("/")
async def root():
    return {"message": "Welcome to mOhiOm Backend API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "r2_configured": r2_storage.configured()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
