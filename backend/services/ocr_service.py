from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from pathlib import Path
from typing import Optional
import os


def extract_text_from_image(image_path: str, source: str = 'whatsapp') -> str:
    """
    Extract text from screenshot using Tesseract OCR.
    Optimized for WhatsApp screenshot formats.

    Args:
        image_path: Path to the image file
        source: Source type for optimized preprocessing

    Returns:
        Extracted text string
    """
    try:
        image = Image.open(image_path)

        # Apply source-specific preprocessing
        if source == 'whatsapp':
            image = preprocess_whatsapp_screenshot(image)
        else:
            image = preprocess_generic(image)

        # OCR with optimized config for phone numbers
        # PSM 6: Assume uniform block of text
        # OEM 3: Default, based on what's available
        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(image, config=custom_config)

        # Also try PSM 11 (sparse text) for contact lists
        text_sparse = pytesseract.image_to_string(image, config=r'--oem 3 --psm 11')

        # Combine results (dedupe later in phone parser)
        return text + "\n" + text_sparse

    except Exception as e:
        raise Exception(f"OCR failed: {str(e)}")


def preprocess_whatsapp_screenshot(image: Image.Image) -> Image.Image:
    """
    Preprocess WhatsApp screenshot for better OCR accuracy.

    WhatsApp characteristics:
    - Green/teal header (#075E54 dark mode, #128C7E light mode)
    - White or dark gray background
    - Clean sans-serif fonts
    - Phone numbers often in gray text
    """
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')

    # Resize if too small (OCR works better with larger images)
    min_width = 1000
    if image.width < min_width:
        ratio = min_width / image.width
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Convert to grayscale
    image = image.convert('L')

    # Enhance contrast (WhatsApp gray text needs this)
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)

    # Sharpen for cleaner edges
    image = image.filter(ImageFilter.SHARPEN)

    # Apply threshold to make text more distinct
    # This helps with light gray phone numbers
    threshold = 180
    image = image.point(lambda p: 255 if p > threshold else 0)

    return image


def preprocess_generic(image: Image.Image) -> Image.Image:
    """Generic preprocessing for non-WhatsApp screenshots."""
    # Convert to grayscale
    if image.mode != 'L':
        image = image.convert('L')

    # Basic contrast enhancement
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)

    return image


def get_image_metadata(image_path: str) -> dict:
    """Extract metadata from screenshot for source detection."""
    try:
        image = Image.open(image_path)
        return {
            'width': image.width,
            'height': image.height,
            'format': image.format,
            'mode': image.mode,
            'size_kb': Path(image_path).stat().st_size / 1024
        }
    except Exception as e:
        return {'error': str(e)}


def detect_source(image_path: str) -> str:
    """
    Attempt to detect the source of the screenshot based on visual characteristics.

    Returns: 'whatsapp', 'sms', 'call_log', or 'unknown'
    """
    try:
        image = Image.open(image_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Sample colors from the top portion (usually contains app header)
        width, height = image.size
        header_region = image.crop((0, 0, width, min(100, height)))

        # Get dominant colors
        colors = header_region.getcolors(maxcolors=1000)
        if not colors:
            return 'unknown'

        # WhatsApp green: RGB around (7, 94, 84) or (18, 140, 126)
        for count, color in sorted(colors, reverse=True)[:10]:
            r, g, b = color[:3] if len(color) >= 3 else (0, 0, 0)
            # Check for WhatsApp teal/green
            if (0 <= r <= 30 and 80 <= g <= 160 and 70 <= b <= 140):
                return 'whatsapp'

        return 'unknown'
    except Exception:
        return 'unknown'
