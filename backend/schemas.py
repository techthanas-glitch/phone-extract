from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Screenshot Schemas
class ScreenshotBase(BaseModel):
    filename: str
    source: Optional[str] = "whatsapp"
    notes: Optional[str] = None


class ScreenshotCreate(ScreenshotBase):
    file_path: str


class ExtractedNumberSummary(BaseModel):
    id: str
    raw_number: str
    normalized_number: Optional[str] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    is_valid: bool

    class Config:
        from_attributes = True


class ScreenshotResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    upload_date: datetime
    ocr_text: Optional[str] = None
    processed: bool
    source: Optional[str] = None
    notes: Optional[str] = None
    extracted_numbers: List[ExtractedNumberSummary] = []

    class Config:
        from_attributes = True


class ScreenshotListResponse(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    processed: bool
    source: Optional[str] = None
    numbers_count: int = 0

    class Config:
        from_attributes = True


# Extracted Number Schemas
class GroupSummary(BaseModel):
    id: str
    name: str
    color: str

    class Config:
        from_attributes = True


class ExtractedNumberResponse(BaseModel):
    id: str
    screenshot_id: Optional[str] = None
    raw_number: str
    normalized_number: Optional[str] = None
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    carrier: Optional[str] = None
    number_type: Optional[str] = None
    is_valid: bool
    extracted_at: datetime
    groups: List[GroupSummary] = []
    comparison_status: Optional[str] = None  # "new", "existing", "unknown"

    class Config:
        from_attributes = True


class NumbersByCountry(BaseModel):
    country_code: str
    country_name: str
    count: int
    numbers: List[ExtractedNumberResponse]


class NumbersStats(BaseModel):
    total: int
    valid: int
    invalid: int
    by_country: dict


# Group Schemas
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    color: str
    is_system: bool
    created_at: datetime
    numbers_count: int = 0

    class Config:
        from_attributes = True


class GroupDetailResponse(GroupResponse):
    numbers: List[ExtractedNumberResponse] = []


class AddNumbersToGroup(BaseModel):
    number_ids: List[str]


# Existing Contact Schemas
class ExistingContactResponse(BaseModel):
    id: str
    normalized_number: str
    raw_number: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    source: str
    zoho_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Comparison Schemas
class ComparisonResultResponse(BaseModel):
    id: str
    extracted_number_id: str
    existing_contact_id: Optional[str] = None
    match_type: str
    confidence: float
    compared_at: datetime
    extracted_number: ExtractedNumberSummary
    existing_contact: Optional[ExistingContactResponse] = None

    class Config:
        from_attributes = True


class ComparisonStats(BaseModel):
    total_extracted: int
    total_matched: int
    total_new: int
    exact_matches: int
    partial_matches: int


# Import Schemas
class CSVColumnMapping(BaseModel):
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    zoho_id: Optional[str] = None


class ImportResult(BaseModel):
    total_rows: int
    imported: int
    skipped: int
    duplicates: int
    invalid_phones: int


class CSVPreviewResponse(BaseModel):
    columns: List[str]
    sample_rows: List[dict]
    suggested_mapping: CSVColumnMapping


# Extraction Schemas
class ExtractionRequest(BaseModel):
    source: str = "whatsapp"


class ExtractionResult(BaseModel):
    screenshot_id: str
    ocr_text: str
    numbers_found: int
    numbers: List[ExtractedNumberSummary]
