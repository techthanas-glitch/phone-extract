# PhoneExtract - Screenshot Phone Number Database

Extract phone numbers from WhatsApp screenshots, store them in a database, and compare against existing Zoho CRM contacts.

## Features

- **Screenshot Upload** - Drag-drop WhatsApp screenshots
- **OCR Extraction** - Tesseract OCR optimized for WhatsApp formats
- **Phone Parsing** - Google's libphonenumber for E.164 normalization
- **Country Grouping** - Automatic grouping by country code
- **CSV Import** - Import existing contacts from Zoho CRM
- **Comparison** - Find new numbers not in your database
- **Export** - Export results to CSV

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python FastAPI, SQLAlchemy |
| OCR | Tesseract (pytesseract) |
| Phone Parsing | phonenumbers library |
| Database | SQLite |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Tesseract OCR

### Install Tesseract

**Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki

**Mac:** `brew install tesseract`

**Linux:** `sudo apt install tesseract-ocr`

### Run Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Access at http://localhost:3000

## Deployment

### Render (Backend)

1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Select "Docker" environment
4. Render will use the included `Dockerfile`

### Vercel (Frontend)

1. Import your repo to Vercel
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com`

## API Documentation

Once running, visit http://localhost:8000/docs for Swagger UI.

## License

MIT
