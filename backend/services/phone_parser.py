import re
import phonenumbers
from phonenumbers import geocoder, carrier
from typing import List, Dict, Optional

# WhatsApp-specific patterns (ordered by specificity)
WHATSAPP_PATTERNS = [
    # WhatsApp contact info format: "Phone: +1 555-123-4567"
    r'(?:Phone|Mobile|Cell)[\s:]+(\+?\d[\d\s\-().]{8,20})',

    # International format with + prefix (most reliable)
    r'(\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9})',

    # WhatsApp group participant format: "+1 555 123 4567"
    r'(\+\d{1,3}\s\d{3}\s\d{3}\s\d{4})',

    # US format: (555) 123-4567 or 555-123-4567
    r'(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})',

    # Indian format: 98765 43210 or 9876543210
    r'(\b[6-9]\d{4}[\s]?\d{5}\b)',

    # Generic: 10+ consecutive digits (fallback)
    r'(\b\d{10,12}\b)',
]

# Generic patterns for non-WhatsApp sources
GENERIC_PATTERNS = [
    r'(\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9})',
    r'(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})',
    r'(\b\d{10,12}\b)',
]

# Priority regions for parsing (US and India primary)
PRIORITY_REGIONS = ['US', 'IN', 'CA', 'GB', 'AU', 'AE', 'PK', 'BD']


def extract_phones_from_text(text: str, source: str = 'whatsapp') -> List[Dict]:
    """
    Extract and normalize phone numbers from OCR text.
    Optimized for WhatsApp screenshot formats.

    Returns list of:
    {
        'raw': '(555) 123-4567',
        'normalized': '+15551234567',
        'country_code': '+1',
        'country_name': 'United States',
        'carrier': 'Verizon Wireless',
        'is_valid': True,
        'number_type': 'MOBILE'
    }
    """
    candidates = []

    # Use source-specific patterns
    patterns = WHATSAPP_PATTERNS if source == 'whatsapp' else GENERIC_PATTERNS

    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        candidates.extend(matches)

    # Clean and deduplicate candidates
    cleaned_candidates = []
    for c in candidates:
        # Remove common WhatsApp prefixes
        cleaned = re.sub(r'^(Phone|Mobile|Cell)[\s:]+', '', c, flags=re.IGNORECASE)
        cleaned = cleaned.strip()
        if cleaned and len(cleaned) >= 7:  # Minimum viable phone length
            cleaned_candidates.append(cleaned)

    # Remove duplicates while preserving order
    candidates = list(dict.fromkeys(cleaned_candidates))

    results = []
    seen_normalized = set()

    for candidate in candidates:
        parsed_info = parse_phone_number(candidate)
        if parsed_info:
            # Skip if we've already seen this normalized number
            norm = parsed_info.get('normalized')
            if norm and norm not in seen_normalized:
                seen_normalized.add(norm)
                results.append(parsed_info)
            elif not norm and parsed_info.get('raw') not in seen_normalized:
                # Keep invalid numbers too, but dedupe by raw
                seen_normalized.add(parsed_info.get('raw'))
                results.append(parsed_info)

    return results


def parse_phone_number(raw_number: str) -> Optional[Dict]:
    """Parse a single phone number string."""

    # Clean up the string but preserve + prefix
    cleaned = raw_number.strip()

    # Try parsing with each priority region
    for region in PRIORITY_REGIONS + [None]:
        try:
            parsed = phonenumbers.parse(cleaned, region)

            if phonenumbers.is_valid_number(parsed):
                number_type_val = phonenumbers.number_type(parsed)
                number_type_str = str(number_type_val).split('.')[-1] if number_type_val else None

                return {
                    'raw': raw_number,
                    'normalized': phonenumbers.format_number(
                        parsed,
                        phonenumbers.PhoneNumberFormat.E164
                    ),
                    'country_code': f'+{parsed.country_code}',
                    'country_name': geocoder.country_name_for_number(parsed, 'en') or 'Unknown',
                    'carrier': carrier.name_for_number(parsed, 'en') or None,
                    'is_valid': True,
                    'number_type': number_type_str
                }
        except Exception:
            continue

    # Return as invalid if parsing failed
    return {
        'raw': raw_number,
        'normalized': None,
        'country_code': None,
        'country_name': None,
        'carrier': None,
        'is_valid': False,
        'number_type': None
    }


def normalize_for_comparison(number: str) -> str:
    """Normalize number for comparison (strips formatting)."""
    if not number:
        return ''

    # Try US first, then India (primary regions)
    for region in ['US', 'IN']:
        try:
            parsed = phonenumbers.parse(number, region)
            if phonenumbers.is_valid_number(parsed):
                return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception:
            continue

    # Fallback: just keep digits and + prefix
    if number.startswith('+'):
        return '+' + re.sub(r'[^\d]', '', number[1:])
    return re.sub(r'[^\d]', '', number)


def get_country_from_number(normalized_number: str) -> Dict:
    """Get country information from a normalized E.164 number."""
    if not normalized_number:
        return {'country_code': None, 'country_name': None}

    try:
        parsed = phonenumbers.parse(normalized_number)
        return {
            'country_code': f'+{parsed.country_code}',
            'country_name': geocoder.country_name_for_number(parsed, 'en') or 'Unknown'
        }
    except Exception:
        return {'country_code': None, 'country_name': None}
