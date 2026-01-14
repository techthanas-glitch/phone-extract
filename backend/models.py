from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Table, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from database import Base

# Many-to-many association table for numbers and groups
number_groups = Table(
    'number_groups',
    Base.metadata,
    Column('extracted_number_id', String, ForeignKey('extracted_numbers.id', ondelete='CASCADE')),
    Column('group_id', String, ForeignKey('groups.id', ondelete='CASCADE'))
)


class Screenshot(Base):
    __tablename__ = 'screenshots'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    ocr_text = Column(Text, nullable=True)
    processed = Column(Boolean, default=False)
    source = Column(String(100), nullable=True)  # "whatsapp", "sms", "call_log"
    notes = Column(Text, nullable=True)

    # Relationship
    extracted_numbers = relationship("ExtractedNumber", back_populates="screenshot", cascade="all, delete-orphan")


class ExtractedNumber(Base):
    __tablename__ = 'extracted_numbers'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    screenshot_id = Column(String, ForeignKey('screenshots.id', ondelete='CASCADE'))
    raw_number = Column(String(50))  # As found in screenshot
    normalized_number = Column(String(20))  # E.164 format: +14155551234
    country_code = Column(String(5))  # "+1", "+91"
    country_name = Column(String(100))  # "United States", "India"
    carrier = Column(String(100), nullable=True)
    number_type = Column(String(50), nullable=True)  # MOBILE, FIXED_LINE, etc.
    is_valid = Column(Boolean, default=True)
    extracted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    screenshot = relationship("Screenshot", back_populates="extracted_numbers")
    groups = relationship("Group", secondary=number_groups, back_populates="numbers")
    comparison_results = relationship("ComparisonResult", back_populates="extracted_number", cascade="all, delete-orphan")


class ExistingContact(Base):
    """Imported from Zoho CRM CSV"""
    __tablename__ = 'existing_contacts'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    normalized_number = Column(String(20), unique=True, index=True)
    raw_number = Column(String(50))  # Original from CSV
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    source = Column(String(100), default="zoho_csv")
    zoho_id = Column(String(100), nullable=True)  # Original Zoho record ID
    created_at = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(JSON, nullable=True)  # Extra fields from CSV

    # Relationship
    comparison_results = relationship("ComparisonResult", back_populates="existing_contact")


class Group(Base):
    __tablename__ = 'groups'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), default="#6366f1")  # Hex color
    is_system = Column(Boolean, default=False)  # True for auto-generated country groups
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    numbers = relationship("ExtractedNumber", secondary=number_groups, back_populates="groups")


class ComparisonResult(Base):
    __tablename__ = 'comparison_results'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    extracted_number_id = Column(String, ForeignKey('extracted_numbers.id', ondelete='CASCADE'))
    existing_contact_id = Column(String, ForeignKey('existing_contacts.id', ondelete='SET NULL'), nullable=True)
    match_type = Column(String(20))  # "exact", "partial", "none"
    confidence = Column(Float, default=1.0)
    compared_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    extracted_number = relationship("ExtractedNumber", back_populates="comparison_results")
    existing_contact = relationship("ExistingContact", back_populates="comparison_results")
