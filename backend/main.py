from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

from database import init_db
from routers import screenshots, extraction, numbers, groups, comparison, import_export

load_dotenv()

app = FastAPI(
    title="PhoneExtract API",
    description="Extract phone numbers from screenshots and compare with existing contacts",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add production origins from environment
if os.getenv("ALLOWED_ORIGINS"):
    origins.extend(os.getenv("ALLOWED_ORIGINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files for serving uploaded screenshots
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(screenshots.router, prefix="/api/screenshots", tags=["Screenshots"])
app.include_router(extraction.router, prefix="/api/extract", tags=["Extraction"])
app.include_router(numbers.router, prefix="/api/numbers", tags=["Numbers"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(comparison.router, prefix="/api/compare", tags=["Comparison"])
app.include_router(import_export.router, prefix="/api", tags=["Import/Export"])


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "PhoneExtract API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
