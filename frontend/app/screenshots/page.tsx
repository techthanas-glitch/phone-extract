'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Image, Trash2, Eye, Wand2, Check, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getScreenshots, deleteScreenshot, extractFromScreenshot } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface Screenshot {
  id: string;
  filename: string;
  upload_date: string;
  processed: boolean;
  source: string | null;
  numbers_count: number;
}

export default function ScreenshotsPage() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  useEffect(() => {
    loadScreenshots();
  }, [page]);

  async function loadScreenshots() {
    setLoading(true);
    try {
      const result = await getScreenshots(page, 20);
      setScreenshots(result.items || []);
      setTotalPages(result.pages || 1);
    } catch (error) {
      console.error('Failed to load screenshots:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this screenshot and its extracted numbers?')) return;

    try {
      await deleteScreenshot(id);
      setScreenshots(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }

  async function handleExtract(id: string) {
    setExtractingId(id);
    try {
      const result = await extractFromScreenshot(id);
      setScreenshots(prev =>
        prev.map(s =>
          s.id === id
            ? { ...s, processed: true, numbers_count: result.numbers_found }
            : s
        )
      );
    } catch (error) {
      console.error('Extraction failed:', error);
    } finally {
      setExtractingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Screenshots</h1>
          <p className="text-gray-500 mt-1">
            Manage your uploaded screenshots
          </p>
        </div>
        <Link href="/upload">
          <Button>Upload More</Button>
        </Link>
      </div>

      {screenshots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No screenshots yet
            </h3>
            <p className="text-gray-500 mb-4">
              Upload your first screenshot to get started
            </p>
            <Link href="/upload">
              <Button>Upload Screenshots</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {screenshots.map((screenshot) => (
              <Card key={screenshot.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Image className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                        {screenshot.filename}
                      </span>
                    </div>
                    {screenshot.processed ? (
                      <Badge variant="success" size="sm">
                        <Check className="h-3 w-3 mr-1" />
                        Processed
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-500 mb-4">
                    <div>Uploaded: {formatDate(screenshot.upload_date)}</div>
                    {screenshot.source && (
                      <div>Source: {screenshot.source}</div>
                    )}
                    {screenshot.processed && (
                      <div className="text-primary-600 font-medium">
                        {screenshot.numbers_count} numbers extracted
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {!screenshot.processed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleExtract(screenshot.id)}
                        loading={extractingId === screenshot.id}
                        className="flex-1"
                      >
                        <Wand2 className="h-4 w-4 mr-1" />
                        Extract
                      </Button>
                    )}
                    <Link href={`/screenshots/${screenshot.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(screenshot.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
