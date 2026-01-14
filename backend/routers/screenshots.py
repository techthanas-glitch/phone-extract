from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import aiofiles
from datetime import datetime

from database import get_db
from models import Screenshot, ExtractedNumber
from schemas import ScreenshotResponse, ScreenshotListResponse

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 10485760))  # 10MB default


@router.post("/upload", response_model=dict)
async def upload_screenshots(
    files: List[UploadFile] = File(...),
    source: str = Query("whatsapp", description="Source of screenshots"),
    db: Session = Depends(get_db)
):
    """Upload one or more screenshots."""
    uploaded = []
    errors = []

    for file in files:
        try:
            # Validate file type
            if not file.content_type or not file.content_type.startswith('image/'):
                errors.append({"filename": file.filename, "error": "Not an image file"})
                continue

            # Generate unique filename
            ext = os.path.splitext(file.filename)[1] if file.filename else '.png'
            unique_filename = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)

            # Save file
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()
                if len(content) > MAX_UPLOAD_SIZE:
                    errors.append({"filename": file.filename, "error": "File too large"})
                    continue
                await out_file.write(content)

            # Create database record
            screenshot = Screenshot(
                filename=file.filename or unique_filename,
                file_path=file_path,
                source=source,
                processed=False
            )
            db.add(screenshot)
            db.commit()
            db.refresh(screenshot)

            uploaded.append({
                "id": screenshot.id,
                "filename": screenshot.filename,
                "upload_date": screenshot.upload_date.isoformat()
            })

        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "uploaded": len(uploaded),
        "errors": len(errors),
        "screenshots": uploaded,
        "error_details": errors if errors else None
    }


@router.get("", response_model=dict)
async def list_screenshots(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    processed: Optional[bool] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all screenshots with pagination."""
    query = db.query(Screenshot)

    if processed is not None:
        query = query.filter(Screenshot.processed == processed)
    if source:
        query = query.filter(Screenshot.source == source)

    total = query.count()
    screenshots = query.order_by(Screenshot.upload_date.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    items = []
    for s in screenshots:
        numbers_count = db.query(ExtractedNumber).filter(
            ExtractedNumber.screenshot_id == s.id
        ).count()
        items.append({
            "id": s.id,
            "filename": s.filename,
            "upload_date": s.upload_date.isoformat(),
            "processed": s.processed,
            "source": s.source,
            "numbers_count": numbers_count
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/{screenshot_id}", response_model=ScreenshotResponse)
async def get_screenshot(
    screenshot_id: str,
    db: Session = Depends(get_db)
):
    """Get a single screenshot with its extracted numbers."""
    screenshot = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()

    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return screenshot


@router.delete("/{screenshot_id}")
async def delete_screenshot(
    screenshot_id: str,
    db: Session = Depends(get_db)
):
    """Delete a screenshot and its extracted numbers."""
    screenshot = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()

    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    # Delete the file
    try:
        if os.path.exists(screenshot.file_path):
            os.remove(screenshot.file_path)
    except Exception:
        pass  # Continue even if file deletion fails

    # Delete from database (cascade will delete extracted numbers)
    db.delete(screenshot)
    db.commit()

    return {"message": "Screenshot deleted successfully"}


@router.patch("/{screenshot_id}")
async def update_screenshot(
    screenshot_id: str,
    source: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update screenshot metadata."""
    screenshot = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()

    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if source is not None:
        screenshot.source = source
    if notes is not None:
        screenshot.notes = notes

    db.commit()
    db.refresh(screenshot)

    return {"message": "Screenshot updated", "id": screenshot.id}
