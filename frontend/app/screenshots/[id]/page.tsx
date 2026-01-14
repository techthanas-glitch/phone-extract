'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wand2, Trash2, Clock, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import NumbersTable from '@/components/NumbersTable';
import { getScreenshot, extractFromScreenshot, deleteScreenshot } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ScreenshotDetail {
  id: string;
  filename: string;
  file_path: string;
  upload_date: string;
  ocr_text: string | null;
  processed: boolean;
  source: string | null;
  notes: string | null;
  extracted_numbers: any[];
}

export default function ScreenshotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [screenshot, setScreenshot] = useState<ScreenshotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadScreenshot();
  }, [params.id]);

  async function loadScreenshot() {
    try {
      const data = await getScreenshot(params.id as string);
      setScreenshot(data);
    } catch (error) {
      console.error('Failed to load screenshot:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    if (!screenshot) return;

    setExtracting(true);
    try {
      const result = await extractFromScreenshot(screenshot.id);
      setScreenshot(prev => prev ? {
        ...prev,
        processed: true,
        ocr_text: result.ocr_text,
        extracted_numbers: result.numbers
      } : null);
    } catch (error) {
      console.error('Extraction failed:', error);
    } finally {
      setExtracting(false);
    }
  }

  async function handleDelete() {
    if (!screenshot || !confirm('Delete this screenshot and all extracted numbers?')) return;

    try {
      await deleteScreenshot(screenshot.id);
      router.push('/screenshots');
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!screenshot) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Screenshot not found</p>
        <Link href="/screenshots">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Screenshots
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/screenshots">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{screenshot.filename}</h1>
            <p className="text-gray-500">
              Uploaded {formatDate(screenshot.upload_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!screenshot.processed && (
            <Button onClick={handleExtract} loading={extracting}>
              <Wand2 className="h-4 w-4 mr-2" />
              Extract Numbers
            </Button>
          )}
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Screenshot Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              {screenshot.processed ? (
                <Badge variant="success">
                  <Check className="h-3 w-3 mr-1" />
                  Processed
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium">{screenshot.source || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Numbers Found</p>
              <p className="font-medium">{screenshot.extracted_numbers?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Upload Date</p>
              <p className="font-medium">{formatDate(screenshot.upload_date)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OCR Text */}
      {screenshot.ocr_text && (
        <Card>
          <CardHeader>
            <CardTitle>OCR Text</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
              {screenshot.ocr_text}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Extracted Numbers */}
      <Card>
        <CardHeader>
          <CardTitle>
            Extracted Numbers ({screenshot.extracted_numbers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {screenshot.extracted_numbers && screenshot.extracted_numbers.length > 0 ? (
            <NumbersTable
              numbers={screenshot.extracted_numbers.map(n => ({
                ...n,
                groups: n.groups || [],
                comparison_status: 'unknown' as const
              }))}
              showActions={true}
            />
          ) : (
            <div className="py-12 text-center text-gray-500">
              {screenshot.processed
                ? 'No phone numbers found in this screenshot'
                : 'Click "Extract Numbers" to process this screenshot'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
