const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Screenshot {
  id: string;
  filename: string;
  file_path: string;
  upload_date: string;
  processed: boolean;
  source: string | null;
  numbers_count: number;
}

export interface ExtractedNumber {
  id: string;
  screenshot_id: string | null;
  raw_number: string;
  normalized_number: string | null;
  country_code: string | null;
  country_name: string | null;
  carrier: string | null;
  number_type: string | null;
  is_valid: boolean;
  extracted_at: string;
  groups: { id: string; name: string; color: string }[];
  comparison_status: 'new' | 'existing' | 'unknown';
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  created_at: string;
  numbers_count: number;
}

export interface ExistingContact {
  id: string;
  normalized_number: string;
  raw_number: string | null;
  name: string | null;
  email: string | null;
  company: string | null;
  source: string;
  zoho_id: string | null;
  created_at: string;
}

export interface ComparisonStats {
  total_extracted: number;
  total_existing_contacts: number;
  exact_matches: number;
  partial_matches: number;
  new_numbers: number;
  not_compared: number;
  match_rate: number;
}

// API Functions

export async function uploadScreenshots(files: File[], source: string = 'whatsapp') {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch(`${API_URL}/api/screenshots/upload?source=${source}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  return response.json();
}

export async function getScreenshots(page = 1, limit = 20) {
  const response = await fetch(`${API_URL}/api/screenshots?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch screenshots');
  return response.json();
}

export async function getScreenshot(id: string) {
  const response = await fetch(`${API_URL}/api/screenshots/${id}`);
  if (!response.ok) throw new Error('Screenshot not found');
  return response.json();
}

export async function deleteScreenshot(id: string) {
  const response = await fetch(`${API_URL}/api/screenshots/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete screenshot');
  return response.json();
}

export async function extractFromScreenshot(id: string, source?: string) {
  const url = source
    ? `${API_URL}/api/extract/${id}?source=${source}`
    : `${API_URL}/api/extract/${id}`;

  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) throw new Error('Extraction failed');
  return response.json();
}

export async function batchExtract(screenshotIds?: string[], extractAll = false) {
  const response = await fetch(`${API_URL}/api/extract/batch?extract_all_unprocessed=${extractAll}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: screenshotIds ? JSON.stringify(screenshotIds) : undefined,
  });
  if (!response.ok) throw new Error('Batch extraction failed');
  return response.json();
}

export async function getNumbers(params: {
  page?: number;
  limit?: number;
  country_code?: string;
  is_valid?: boolean;
  search?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.country_code) searchParams.set('country_code', params.country_code);
  if (params.is_valid !== undefined) searchParams.set('is_valid', params.is_valid.toString());
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`${API_URL}/api/numbers?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch numbers');
  return response.json();
}

export async function getNumbersByCountry() {
  const response = await fetch(`${API_URL}/api/numbers/by-country`);
  if (!response.ok) throw new Error('Failed to fetch numbers by country');
  return response.json();
}

export async function getNumbersStats() {
  const response = await fetch(`${API_URL}/api/numbers/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function getGroups(includeSystem = true) {
  const response = await fetch(`${API_URL}/api/groups?include_system=${includeSystem}`);
  if (!response.ok) throw new Error('Failed to fetch groups');
  return response.json();
}

export async function createGroup(name: string, description?: string, color?: string) {
  const response = await fetch(`${API_URL}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, color }),
  });
  if (!response.ok) throw new Error('Failed to create group');
  return response.json();
}

export async function addNumbersToGroup(groupId: string, numberIds: string[]) {
  const response = await fetch(`${API_URL}/api/groups/${groupId}/numbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number_ids: numberIds }),
  });
  if (!response.ok) throw new Error('Failed to add numbers to group');
  return response.json();
}

export async function runComparison() {
  const response = await fetch(`${API_URL}/api/compare/run`, { method: 'POST' });
  if (!response.ok) throw new Error('Comparison failed');
  return response.json();
}

export async function getComparisonStats(): Promise<ComparisonStats> {
  const response = await fetch(`${API_URL}/api/compare/stats`);
  if (!response.ok) throw new Error('Failed to fetch comparison stats');
  return response.json();
}

export async function getNewNumbers(page = 1, limit = 50) {
  const response = await fetch(`${API_URL}/api/compare/new?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch new numbers');
  return response.json();
}

export async function previewCsvMapping(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/import/mapping-preview`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to preview CSV');
  return response.json();
}

export async function importZohoCsv(
  file: File,
  phoneColumn: string,
  nameColumn?: string,
  emailColumn?: string,
  companyColumn?: string
) {
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams();
  params.set('phone_column', phoneColumn);
  if (nameColumn) params.set('name_column', nameColumn);
  if (emailColumn) params.set('email_column', emailColumn);
  if (companyColumn) params.set('company_column', companyColumn);

  const response = await fetch(`${API_URL}/api/import/zoho-csv?${params}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Import failed');
  return response.json();
}

export async function getExistingContacts(page = 1, limit = 50, search?: string) {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (search) params.set('search', search);

  const response = await fetch(`${API_URL}/api/existing-contacts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch contacts');
  return response.json();
}

export function getExportUrl(type: 'numbers' | 'comparison' | 'new-numbers') {
  return `${API_URL}/api/export/${type}`;
}
