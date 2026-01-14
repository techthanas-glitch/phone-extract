from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from database import get_db
from models import ExtractedNumber, ComparisonResult
from schemas import ExtractedNumberResponse, NumbersByCountry, NumbersStats

router = APIRouter()


@router.get("", response_model=dict)
async def list_numbers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    country_code: Optional[str] = None,
    is_valid: Optional[bool] = None,
    screenshot_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all extracted numbers with filters and pagination."""
    query = db.query(ExtractedNumber)

    if country_code:
        query = query.filter(ExtractedNumber.country_code == country_code)
    if is_valid is not None:
        query = query.filter(ExtractedNumber.is_valid == is_valid)
    if screenshot_id:
        query = query.filter(ExtractedNumber.screenshot_id == screenshot_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ExtractedNumber.raw_number.like(search_pattern)) |
            (ExtractedNumber.normalized_number.like(search_pattern))
        )

    total = query.count()
    numbers = query.order_by(ExtractedNumber.extracted_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    # Get comparison status for each number
    items = []
    for num in numbers:
        comparison = db.query(ComparisonResult).filter(
            ComparisonResult.extracted_number_id == num.id
        ).first()

        status = "unknown"
        if comparison:
            status = "existing" if comparison.match_type in ["exact", "partial"] else "new"

        items.append({
            "id": num.id,
            "screenshot_id": num.screenshot_id,
            "raw_number": num.raw_number,
            "normalized_number": num.normalized_number,
            "country_code": num.country_code,
            "country_name": num.country_name,
            "carrier": num.carrier,
            "number_type": num.number_type,
            "is_valid": num.is_valid,
            "extracted_at": num.extracted_at.isoformat(),
            "groups": [{"id": g.id, "name": g.name, "color": g.color} for g in num.groups],
            "comparison_status": status
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/by-country", response_model=List[dict])
async def get_numbers_by_country(
    db: Session = Depends(get_db)
):
    """Get numbers grouped by country code."""
    # Get counts by country
    country_counts = db.query(
        ExtractedNumber.country_code,
        ExtractedNumber.country_name,
        func.count(ExtractedNumber.id).label('count')
    ).filter(
        ExtractedNumber.country_code.isnot(None)
    ).group_by(
        ExtractedNumber.country_code,
        ExtractedNumber.country_name
    ).order_by(
        func.count(ExtractedNumber.id).desc()
    ).all()

    result = []
    for cc, cn, count in country_counts:
        # Get numbers for this country
        numbers = db.query(ExtractedNumber).filter(
            ExtractedNumber.country_code == cc
        ).limit(100).all()

        result.append({
            "country_code": cc,
            "country_name": cn or "Unknown",
            "count": count,
            "numbers": [
                {
                    "id": n.id,
                    "raw_number": n.raw_number,
                    "normalized_number": n.normalized_number,
                    "is_valid": n.is_valid
                }
                for n in numbers
            ]
        })

    return result


@router.get("/duplicates", response_model=List[dict])
async def find_duplicates(
    db: Session = Depends(get_db)
):
    """Find duplicate phone numbers across screenshots."""
    # Find normalized numbers that appear more than once
    duplicates = db.query(
        ExtractedNumber.normalized_number,
        func.count(ExtractedNumber.id).label('count')
    ).filter(
        ExtractedNumber.normalized_number.isnot(None)
    ).group_by(
        ExtractedNumber.normalized_number
    ).having(
        func.count(ExtractedNumber.id) > 1
    ).all()

    result = []
    for norm_number, count in duplicates:
        # Get all instances
        instances = db.query(ExtractedNumber).filter(
            ExtractedNumber.normalized_number == norm_number
        ).all()

        result.append({
            "normalized_number": norm_number,
            "count": count,
            "instances": [
                {
                    "id": n.id,
                    "screenshot_id": n.screenshot_id,
                    "raw_number": n.raw_number,
                    "extracted_at": n.extracted_at.isoformat()
                }
                for n in instances
            ]
        })

    return result


@router.get("/stats", response_model=dict)
async def get_numbers_stats(
    db: Session = Depends(get_db)
):
    """Get statistics about extracted numbers."""
    total = db.query(ExtractedNumber).count()
    valid = db.query(ExtractedNumber).filter(ExtractedNumber.is_valid == True).count()
    invalid = total - valid

    # Count by country
    by_country = db.query(
        ExtractedNumber.country_code,
        ExtractedNumber.country_name,
        func.count(ExtractedNumber.id).label('count')
    ).filter(
        ExtractedNumber.country_code.isnot(None)
    ).group_by(
        ExtractedNumber.country_code,
        ExtractedNumber.country_name
    ).order_by(
        func.count(ExtractedNumber.id).desc()
    ).limit(10).all()

    # Count by number type
    by_type = db.query(
        ExtractedNumber.number_type,
        func.count(ExtractedNumber.id).label('count')
    ).filter(
        ExtractedNumber.number_type.isnot(None)
    ).group_by(
        ExtractedNumber.number_type
    ).all()

    return {
        "total": total,
        "valid": valid,
        "invalid": invalid,
        "by_country": [
            {"country_code": cc, "country_name": cn, "count": c}
            for cc, cn, c in by_country
        ],
        "by_type": [
            {"type": t, "count": c}
            for t, c in by_type
        ]
    }


@router.delete("/{number_id}")
async def delete_number(
    number_id: str,
    db: Session = Depends(get_db)
):
    """Delete a single extracted number."""
    number = db.query(ExtractedNumber).filter(ExtractedNumber.id == number_id).first()

    if not number:
        raise HTTPException(status_code=404, detail="Number not found")

    db.delete(number)
    db.commit()

    return {"message": "Number deleted successfully"}


@router.delete("")
async def bulk_delete_numbers(
    number_ids: List[str],
    db: Session = Depends(get_db)
):
    """Delete multiple extracted numbers."""
    deleted = db.query(ExtractedNumber).filter(
        ExtractedNumber.id.in_(number_ids)
    ).delete(synchronize_session=False)

    db.commit()

    return {"deleted": deleted}
