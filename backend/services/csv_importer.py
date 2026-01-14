import pandas as pd
from typing import Dict, List, Optional
from services.phone_parser import normalize_for_comparison, get_country_from_number

# Common Zoho CRM column names for phone numbers
ZOHO_PHONE_COLUMNS = [
    'Phone', 'Mobile', 'phone', 'mobile',
    'Phone Number', 'Mobile Number',
    'Work Phone', 'Home Phone',
    'Primary Phone', 'Secondary Phone'
]

ZOHO_NAME_COLUMNS = [
    'Full Name', 'Name', 'Contact Name',
    'First Name', 'Last Name', 'name'
]

ZOHO_EMAIL_COLUMNS = [
    'Email', 'email', 'Email Address',
    'Primary Email', 'Secondary Email'
]

ZOHO_COMPANY_COLUMNS = [
    'Company', 'Account Name', 'Organization',
    'company', 'Company Name'
]

ZOHO_ID_COLUMNS = [
    'Record Id', 'CONTACTID', 'LEADID',
    'Contact ID', 'Lead ID', 'Id', 'id'
]


def detect_columns(columns: List[str]) -> Dict[str, Optional[str]]:
    """Auto-detect column mappings from CSV headers."""
    mapping = {
        'phone': None,
        'name': None,
        'email': None,
        'company': None,
        'zoho_id': None
    }

    columns_lower = {c.lower(): c for c in columns}

    # Detect phone column
    for phone_col in ZOHO_PHONE_COLUMNS:
        if phone_col.lower() in columns_lower:
            mapping['phone'] = columns_lower[phone_col.lower()]
            break

    # Detect name column
    for name_col in ZOHO_NAME_COLUMNS:
        if name_col.lower() in columns_lower:
            mapping['name'] = columns_lower[name_col.lower()]
            break

    # If no full name, try first + last
    if not mapping['name']:
        first_name = None
        last_name = None
        for col in columns:
            if col.lower() in ['first name', 'firstname', 'first_name']:
                first_name = col
            if col.lower() in ['last name', 'lastname', 'last_name']:
                last_name = col
        if first_name:
            mapping['name'] = first_name  # Will need to combine during import

    # Detect email column
    for email_col in ZOHO_EMAIL_COLUMNS:
        if email_col.lower() in columns_lower:
            mapping['email'] = columns_lower[email_col.lower()]
            break

    # Detect company column
    for company_col in ZOHO_COMPANY_COLUMNS:
        if company_col.lower() in columns_lower:
            mapping['company'] = columns_lower[company_col.lower()]
            break

    # Detect Zoho ID column
    for id_col in ZOHO_ID_COLUMNS:
        if id_col.lower() in columns_lower:
            mapping['zoho_id'] = columns_lower[id_col.lower()]
            break

    return mapping


def preview_csv(file_path: str, rows: int = 5) -> Dict:
    """Preview CSV file and suggest column mappings."""
    try:
        df = pd.read_csv(file_path, nrows=rows)
        columns = df.columns.tolist()
        suggested_mapping = detect_columns(columns)

        return {
            'columns': columns,
            'sample_rows': df.to_dict(orient='records'),
            'suggested_mapping': suggested_mapping
        }
    except Exception as e:
        raise Exception(f"Failed to read CSV: {str(e)}")


def import_contacts_from_csv(
    file_path: str,
    column_mapping: Dict[str, str],
    db_session
) -> Dict:
    """
    Import contacts from CSV file.

    Args:
        file_path: Path to CSV file
        column_mapping: Mapping of field names to CSV columns
        db_session: SQLAlchemy database session

    Returns:
        Import statistics
    """
    from models import ExistingContact

    stats = {
        'total_rows': 0,
        'imported': 0,
        'skipped': 0,
        'duplicates': 0,
        'invalid_phones': 0
    }

    try:
        df = pd.read_csv(file_path)
        stats['total_rows'] = len(df)

        phone_col = column_mapping.get('phone')
        if not phone_col or phone_col not in df.columns:
            raise ValueError("Phone column not found in CSV")

        name_col = column_mapping.get('name')
        email_col = column_mapping.get('email')
        company_col = column_mapping.get('company')
        zoho_id_col = column_mapping.get('zoho_id')

        # Get existing normalized numbers for duplicate checking
        existing_numbers = set(
            row[0] for row in db_session.query(ExistingContact.normalized_number).all()
            if row[0]
        )

        contacts_to_add = []

        for _, row in df.iterrows():
            raw_phone = str(row.get(phone_col, '')).strip()

            if not raw_phone or raw_phone == 'nan':
                stats['skipped'] += 1
                continue

            # Normalize the phone number
            normalized = normalize_for_comparison(raw_phone)

            if not normalized:
                stats['invalid_phones'] += 1
                continue

            # Check for duplicates
            if normalized in existing_numbers:
                stats['duplicates'] += 1
                continue

            # Mark as seen
            existing_numbers.add(normalized)

            # Get country info
            country_info = get_country_from_number(normalized)

            # Build contact record
            contact = ExistingContact(
                normalized_number=normalized,
                raw_number=raw_phone,
                name=str(row.get(name_col, '')).strip() if name_col and name_col in df.columns else None,
                email=str(row.get(email_col, '')).strip() if email_col and email_col in df.columns else None,
                company=str(row.get(company_col, '')).strip() if company_col and company_col in df.columns else None,
                zoho_id=str(row.get(zoho_id_col, '')).strip() if zoho_id_col and zoho_id_col in df.columns else None,
                source='zoho_csv'
            )

            contacts_to_add.append(contact)
            stats['imported'] += 1

        # Bulk insert
        if contacts_to_add:
            db_session.bulk_save_objects(contacts_to_add)
            db_session.commit()

        return stats

    except Exception as e:
        db_session.rollback()
        raise Exception(f"Import failed: {str(e)}")
