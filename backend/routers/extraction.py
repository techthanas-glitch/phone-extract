from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Screenshot, ExtractedNumber
from schemas import ExtractionResult, ExtractedNumberSummary
from services.ocr_service import extract_text_from_image, detect_source
from services.phone_parser import extract_phones_from_text

router = APIRouter()


@router.post("/{screenshot_id}", response_model=ExtractionResult)
async def extract_from_screenshot(
    screenshot_id: str,
    source: str = Query(None, description="Override source detection"),
    db: Session = Depends(get_db)
):
    """Extract phone numbers from a single screenshot."""
    screenshot = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()

    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    # Detect source if not provided
    if not source:
        source = screenshot.source or detect_source(screenshot.file_path)

    try:
        # Run OCR
        ocr_text = extract_text_from_image(screenshot.file_path, source)

        # Extract phone numbers
        phones = extract_phones_from_text(ocr_text, source)

        # Delete existing extracted numbers for this screenshot
        db.query(ExtractedNumber).filter(
            ExtractedNumber.screenshot_id == screenshot_id
        ).delete()

        # Save extracted numbers
        extracted_numbers = []
        for phone in phones:
            number = ExtractedNumber(
                screenshot_id=screenshot_id,
                raw_number=phone['raw'],
                normalized_number=phone.get('normalized'),
                country_code=phone.get('country_code'),
                country_name=phone.get('country_name'),
                carrier=phone.get('carrier'),
                number_type=phone.get('number_type'),
                is_valid=phone.get('is_valid', False)
            )
            db.add(number)
            extracted_numbers.append(number)

        # Update screenshot
        screenshot.ocr_text = ocr_text
        screenshot.processed = True
        screenshot.source = source

        db.commit()

        # Refresh to get IDs
        for num in extracted_numbers:
            db.refresh(num)

        return ExtractionResult(
            screenshot_id=screenshot_id,
            ocr_text=ocr_text,
            numbers_found=len(extracted_numbers),
            numbers=[
                ExtractedNumberSummary(
                    id=n.id,
                    raw_number=n.raw_number,
                    normalized_number=n.normalized_number,
                    country_code=n.country_code,
                    country_name=n.country_name,
                    is_valid=n.is_valid
                )
                for n in extracted_numbers
            ]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/batch", response_model=dict)
async def batch_extract(
    screenshot_ids: List[str] = None,
    extract_all_unprocessed: bool = False,
    db: Session = Depends(get_db)
):
    """Batch extract phone numbers from multiple screenshots."""
    results = []
    errors = []

    if extract_all_unprocessed:
        screenshots = db.query(Screenshot).filter(Screenshot.processed == False).all()
        screenshot_ids = [s.id for s in screenshots]
    elif not screenshot_ids:
        raise HTTPException(
            status_code=400,
            detail="Provide screenshot_ids or set extract_all_unprocessed=true"
        )

    for sid in screenshot_ids:
        try:
            screenshot = db.query(Screenshot).filter(Screenshot.id == sid).first()
            if not screenshot:
                errors.append({"id": sid, "error": "Not found"})
                continue

            source = screenshot.source or detect_source(screenshot.file_path)

            # Run OCR
            ocr_text = extract_text_from_image(screenshot.file_path, source)

            # Extract phone numbers
            phones = extract_phones_from_text(ocr_text, source)

            # Delete existing
            db.query(ExtractedNumber).filter(
                ExtractedNumber.screenshot_id == sid
            ).delete()

            # Save new
            for phone in phones:
                number = ExtractedNumber(
                    screenshot_id=sid,
                    raw_number=phone['raw'],
                    normalized_number=phone.get('normalized'),
                    country_code=phone.get('country_code'),
                    country_name=phone.get('country_name'),
                    carrier=phone.get('carrier'),
                    number_type=phone.get('number_type'),
                    is_valid=phone.get('is_valid', False)
                )
                db.add(number)

            screenshot.ocr_text = ocr_text
            screenshot.processed = True
            screenshot.source = source

            results.append({
                "id": sid,
                "numbers_found": len(phones)
            })

        except Exception as e:
            errors.append({"id": sid, "error": str(e)})

    db.commit()

    return {
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors if errors else None
    }


@router.get("/status/{screenshot_id}")
async def get_extraction_status(
    screenshot_id: str,
    db: Session = Depends(get_db)
):
    """Check extraction status of a screenshot."""
    screenshot = db.query(Screenshot).filter(Screenshot.id == screenshot_id).first()

    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    numbers_count = db.query(ExtractedNumber).filter(
        ExtractedNumber.screenshot_id == screenshot_id
    ).count()

    return {
        "id": screenshot_id,
        "processed": screenshot.processed,
        "has_ocr_text": bool(screenshot.ocr_text),
        "numbers_count": numbers_count
    }
