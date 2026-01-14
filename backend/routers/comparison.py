from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from database import get_db
from models import ExtractedNumber, ExistingContact, ComparisonResult
from services.phone_parser import normalize_for_comparison

router = APIRouter()


@router.post("/run")
async def run_comparison(
    db: Session = Depends(get_db)
):
    """Run comparison of all extracted numbers against existing contacts."""
    # Get all extracted numbers
    extracted_numbers = db.query(ExtractedNumber).filter(
        ExtractedNumber.normalized_number.isnot(None)
    ).all()

    # Get all existing contact numbers for fast lookup
    existing_contacts = db.query(ExistingContact).all()
    existing_map = {c.normalized_number: c for c in existing_contacts}

    # Clear previous comparison results
    db.query(ComparisonResult).delete()

    stats = {
        'total': len(extracted_numbers),
        'exact_matches': 0,
        'partial_matches': 0,
        'new': 0
    }

    for number in extracted_numbers:
        norm = number.normalized_number

        if norm in existing_map:
            # Exact match
            result = ComparisonResult(
                extracted_number_id=number.id,
                existing_contact_id=existing_map[norm].id,
                match_type='exact',
                confidence=1.0
            )
            stats['exact_matches'] += 1
        else:
            # Check for partial match (last 10 digits)
            partial_match = None
            if norm and len(norm) >= 10:
                last_digits = norm[-10:]
                for existing_norm, contact in existing_map.items():
                    if existing_norm and existing_norm.endswith(last_digits):
                        partial_match = contact
                        break

            if partial_match:
                result = ComparisonResult(
                    extracted_number_id=number.id,
                    existing_contact_id=partial_match.id,
                    match_type='partial',
                    confidence=0.8
                )
                stats['partial_matches'] += 1
            else:
                result = ComparisonResult(
                    extracted_number_id=number.id,
                    existing_contact_id=None,
                    match_type='none',
                    confidence=0.0
                )
                stats['new'] += 1

        db.add(result)

    db.commit()

    return {
        'message': 'Comparison complete',
        'stats': stats
    }


@router.get("/results")
async def get_comparison_results(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    match_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all comparison results with pagination."""
    query = db.query(ComparisonResult)

    if match_type:
        query = query.filter(ComparisonResult.match_type == match_type)

    total = query.count()
    results = query.order_by(ComparisonResult.compared_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    items = []
    for r in results:
        item = {
            'id': r.id,
            'match_type': r.match_type,
            'confidence': r.confidence,
            'compared_at': r.compared_at.isoformat(),
            'extracted_number': {
                'id': r.extracted_number.id,
                'raw_number': r.extracted_number.raw_number,
                'normalized_number': r.extracted_number.normalized_number,
                'country_code': r.extracted_number.country_code,
                'country_name': r.extracted_number.country_name
            } if r.extracted_number else None,
            'existing_contact': {
                'id': r.existing_contact.id,
                'normalized_number': r.existing_contact.normalized_number,
                'name': r.existing_contact.name,
                'email': r.existing_contact.email,
                'company': r.existing_contact.company
            } if r.existing_contact else None
        }
        items.append(item)

    return {
        'items': items,
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }


@router.get("/new")
async def get_new_numbers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get numbers NOT found in existing database."""
    query = db.query(ComparisonResult).filter(
        ComparisonResult.match_type == 'none'
    )

    total = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for r in results:
        if r.extracted_number:
            items.append({
                'id': r.extracted_number.id,
                'raw_number': r.extracted_number.raw_number,
                'normalized_number': r.extracted_number.normalized_number,
                'country_code': r.extracted_number.country_code,
                'country_name': r.extracted_number.country_name,
                'carrier': r.extracted_number.carrier,
                'is_valid': r.extracted_number.is_valid,
                'groups': [{'id': g.id, 'name': g.name, 'color': g.color} for g in r.extracted_number.groups]
            })

    return {
        'items': items,
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }


@router.get("/existing")
async def get_existing_numbers(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get numbers that match existing database."""
    query = db.query(ComparisonResult).filter(
        ComparisonResult.match_type.in_(['exact', 'partial'])
    )

    total = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for r in results:
        item = {
            'match_type': r.match_type,
            'confidence': r.confidence,
            'extracted_number': {
                'id': r.extracted_number.id,
                'raw_number': r.extracted_number.raw_number,
                'normalized_number': r.extracted_number.normalized_number,
                'country_code': r.extracted_number.country_code,
                'country_name': r.extracted_number.country_name
            } if r.extracted_number else None,
            'existing_contact': {
                'id': r.existing_contact.id,
                'normalized_number': r.existing_contact.normalized_number,
                'name': r.existing_contact.name,
                'email': r.existing_contact.email,
                'company': r.existing_contact.company
            } if r.existing_contact else None
        }
        items.append(item)

    return {
        'items': items,
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }


@router.get("/stats")
async def get_comparison_stats(
    db: Session = Depends(get_db)
):
    """Get comparison statistics."""
    total_extracted = db.query(ExtractedNumber).count()
    total_existing = db.query(ExistingContact).count()

    exact_matches = db.query(ComparisonResult).filter(
        ComparisonResult.match_type == 'exact'
    ).count()

    partial_matches = db.query(ComparisonResult).filter(
        ComparisonResult.match_type == 'partial'
    ).count()

    new_numbers = db.query(ComparisonResult).filter(
        ComparisonResult.match_type == 'none'
    ).count()

    not_compared = total_extracted - (exact_matches + partial_matches + new_numbers)

    return {
        'total_extracted': total_extracted,
        'total_existing_contacts': total_existing,
        'exact_matches': exact_matches,
        'partial_matches': partial_matches,
        'new_numbers': new_numbers,
        'not_compared': not_compared,
        'match_rate': round((exact_matches + partial_matches) / total_extracted * 100, 2) if total_extracted > 0 else 0
    }
