'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { previewCsvMapping, importZohoCsv } from '@/lib/api';

interface CSVPreview {
  columns: string[];
  sample_rows: any[];
  suggested_mapping: {
    phone?: string;
    name?: string;
    email?: string;
    company?: string;
    zoho_id?: string;
  };
}

interface ImportResult {
  total_rows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  invalid_phones: number;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Column mapping state
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [emailColumn, setEmailColumn] = useState('');
  const [companyColumn, setCompanyColumn] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const csvFile = acceptedFiles[0];
    if (!csvFile) return;

    setFile(csvFile);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const previewResult = await previewCsvMapping(csvFile);
      setPreview(previewResult);

      // Set suggested mappings
      if (previewResult.suggested_mapping) {
        setPhoneColumn(previewResult.suggested_mapping.phone || '');
        setNameColumn(previewResult.suggested_mapping.name || '');
        setEmailColumn(previewResult.suggested_mapping.email || '');
        setCompanyColumn(previewResult.suggested_mapping.company || '');
      }
    } catch (err) {
      setError('Failed to read CSV file');
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: false
  });

  const handleImport = async () => {
    if (!file || !phoneColumn) return;

    setImporting(true);
    setError(null);

    try {
      const importResult = await importZohoCsv(
        file,
        phoneColumn,
        nameColumn || undefined,
        emailColumn || undefined,
        companyColumn || undefined
      );
      setResult(importResult);
    } catch (err) {
      setError('Import failed. Please check your CSV file and try again.');
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setPhoneColumn('');
    setNameColumn('');
    setEmailColumn('');
    setCompanyColumn('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
        <p className="text-gray-500 mt-1">
          Import existing contacts from Zoho CRM CSV export
        </p>
      </div>

      {/* Upload Zone */}
      {!preview && !result && (
        <Card>
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                transition-all duration-200
                ${isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                ${loading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <input {...getInputProps()} />

              {loading ? (
                <div>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
                  <p className="mt-4 text-gray-600">Reading CSV file...</p>
                </div>
              ) : (
                <div>
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="mt-4 text-lg text-gray-600">
                    Drop your CSV file here
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    or click to select file
                  </p>
                  <p className="mt-4 text-xs text-gray-400">
                    Supports Zoho CRM export format
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Column Mapping */}
      {preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>File:</strong> {file?.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Columns found:</strong> {preview.columns.length}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Column *
                  </label>
                  <select
                    value={phoneColumn}
                    onChange={(e) => setPhoneColumn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select column...</option>
                    {preview.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name Column
                  </label>
                  <select
                    value={nameColumn}
                    onChange={(e) => setNameColumn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select column...</option>
                    {preview.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Column
                  </label>
                  <select
                    value={emailColumn}
                    onChange={(e) => setEmailColumn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select column...</option>
                    {preview.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Column
                  </label>
                  <select
                    value={companyColumn}
                    onChange={(e) => setCompanyColumn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select column...</option>
                    {preview.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Table */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows)</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.columns.slice(0, 5).map(col => (
                          <th
                            key={col}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.sample_rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {preview.columns.slice(0, 5).map(col => (
                            <td key={col} className="px-4 py-2 text-sm text-gray-700 truncate max-w-[150px]">
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!phoneColumn}
                  loading={importing}
                >
                  {importing ? 'Importing...' : 'Import Contacts'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {result && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Import Complete!
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">{result.total_rows}</div>
                  <div className="text-sm text-gray-500">Total Rows</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                  <div className="text-sm text-green-800">Imported</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-600">{result.duplicates}</div>
                  <div className="text-sm text-yellow-800">Duplicates</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">{result.invalid_phones}</div>
                  <div className="text-sm text-red-800">Invalid</div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-4">
                <Button variant="outline" onClick={resetForm}>
                  Import More
                </Button>
                <Button onClick={() => window.location.href = '/compare'}>
                  Run Comparison
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
