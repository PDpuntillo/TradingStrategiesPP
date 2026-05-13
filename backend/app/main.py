"""
FastAPI entrypoint.

Run local:
    cd backend
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Docs:
    http://127.0.0.1:8000/docs        (Swagger UI)
    http://127.0.0.1:8000/redoc       (ReDoc)
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import strategies


# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    settings = get_settings()
    logger.info(f"🚀 {settings.app_name} v{settings.app_version} starting...")
    logger.info(f"   Tickers: {list(settings.spreadsheet_ids_map.keys())}")
    logger.info(f"   CORS: {settings.cors_origins_list}")
    yield
    logger.info("👋 Shutting down...")


def create_app() -> FastAPI:
    """Factory para crear la app FastAPI."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(strategies.router)

    # Health
    @app.get("/")
    def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "status": "ok",
            "docs": "/docs",
        }

    @app.get("/health")
    def health():
        return {"status": "healthy"}

    return app


app = create_app()
