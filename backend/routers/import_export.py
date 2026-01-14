from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import aiofiles
import io
import csv

from database import get_db
from models import ExistingContact, ExtractedNumber, ComparisonResult
from schemas import CSVColumnMapping, ImportResult, CSVPreviewResponse, ExistingContactResponse
from services.csv_importer import preview_csv, import_contacts_from_csv

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.post("/import/zoho-csv", response_model=ImportResult)
async def import_zoho_csv(
    file: UploadFile = File(...),
    phone_column: str = Query(..., description="Column name for phone numbers"),
    name_column: Optional[str] = None,
    email_column: Optional[str] = None,
    company_column: Optional[str] = None,
    zoho_id_column: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Import contacts from Zoho CRM CSV file."""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Save uploaded file temporarily
    temp_path = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4()}.csv")

    try:
        async with aiofiles.open(temp_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        # Build column mapping
        mapping = {
            'phone': phone_column,
            'name': name_column,
            'email': email_column,
            'company': company_column,
            'zoho_id': zoho_id_column
        }

        # Import contacts
        result = import_contacts_from_csv(temp_path, mapping, db)

        return ImportResult(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/import/mapping-preview", response_model=CSVPreviewResponse)
async def preview_csv_mapping(
    file: UploadFile = File(...),
):
    """Preview CSV columns and suggest mappings."""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    # Save uploaded file temporarily
    temp_path = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4()}.csv")

    try:
        async with aiofiles.open(temp_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        # Preview CSV
        result = preview_csv(temp_path)

        return CSVPreviewResponse(
            columns=result['columns'],
            sample_rows=result['sample_rows'],
            suggested_mapping=CSVColumnMapping(**{
                k: v for k, v in result['suggested_mapping'].items() if v is not None
            })
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get("/existing-contacts", response_model=dict)
async def list_existing_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List imported existing contacts."""
    query = db.query(ExistingContact)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ExistingContact.normalized_number.like(search_pattern)) |
            (ExistingContact.name.like(search_pattern)) |
            (ExistingContact.email.like(search_pattern)) |
            (ExistingContact.company.like(search_pattern))
        )

    total = query.count()
    contacts = query.order_by(ExistingContact.created_at.desc()) \
        .offset((page - 1) * limit) \
        .limit(limit) \
        .all()

    return {
        'items': [
            {
                'id': c.id,
                'normalized_number': c.normalized_number,
                'raw_number': c.raw_number,
                'name': c.name,
                'email': c.email,
                'company': c.company,
                'source': c.source,
                'zoho_id': c.zoho_id,
                'created_at': c.created_at.isoformat()
            }
            for c in contacts
        ],
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }


@router.delete("/existing-contacts")
async def clear_existing_contacts(
    db: Session = Depends(get_db)
):
    """Clear all existing contacts."""
    # First clear comparison results
    db.query(ComparisonResult).delete()
    # Then clear contacts
    count = db.query(ExistingContact).delete()
    db.commit()

    return {'deleted': count}


@router.get("/export/numbers")
async def export_numbers(
    format: str = Query("csv", description="Export format (csv)"),
    country_code: Optional[str] = None,
    is_valid: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Export extracted numbers as CSV."""
    query = db.query(ExtractedNumber)

    if country_code:
        query = query.filter(ExtractedNumber.country_code == country_code)
    if is_valid is not None:
        query = query.filter(ExtractedNumber.is_valid == is_valid)

    numbers = query.all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'Raw Number', 'Normalized Number', 'Country Code', 'Country Name',
        'Carrier', 'Number Type', 'Is Valid', 'Extracted At'
    ])

    # Data
    for n in numbers:
        writer.writerow([
            n.raw_number,
            n.normalized_number or '',
            n.country_code or '',
            n.country_name or '',
            n.carrier or '',
            n.number_type or '',
            'Yes' if n.is_valid else 'No',
            n.extracted_at.isoformat()
        ])

    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=extracted_numbers.csv'}
    )


@router.get("/export/comparison")
async def export_comparison(
    match_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export comparison results as CSV."""
    query = db.query(ComparisonResult)

    if match_type:
        query = query.filter(ComparisonResult.match_type == match_type)

    results = query.all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'Extracted Number', 'Normalized', 'Country', 'Match Type', 'Confidence',
        'Existing Contact Name', 'Existing Contact Email', 'Existing Contact Company'
    ])

    # Data
    for r in results:
        writer.writerow([
            r.extracted_number.raw_number if r.extracted_number else '',
            r.extracted_number.normalized_number if r.extracted_number else '',
            r.extracted_number.country_name if r.extracted_number else '',
            r.match_type,
            r.confidence,
            r.existing_contact.name if r.existing_contact else '',
            r.existing_contact.email if r.existing_contact else '',
            r.existing_contact.company if r.existing_contact else ''
        ])

    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=comparison_results.csv'}
    )


@router.get("/export/new-numbers")
async def export_new_numbers(
    db: Session = Depends(get_db)
):
    """Export only new numbers (not in existing database) as CSV."""
    results = db.query(ComparisonResult).filter(
        ComparisonResult.match_type == 'none'
    ).all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'Raw Number', 'Normalized Number', 'Country Code', 'Country Name',
        'Carrier', 'Number Type'
    ])

    # Data
    for r in results:
        if r.extracted_number:
            n = r.extracted_number
            writer.writerow([
                n.raw_number,
                n.normalized_number or '',
                n.country_code or '',
                n.country_name or '',
                n.carrier or '',
                n.number_type or ''
            ])

    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=new_numbers.csv'}
    )
