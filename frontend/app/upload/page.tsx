'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import ScreenshotUploader from '@/components/ScreenshotUploader';
import Button from '@/components/ui/Button';
import { extractFromScreenshot, batchExtract } from '@/lib/api';
import { Wand2, ArrowRight, Check, AlertCircle } from 'lucide-react';

interface UploadedScreenshot {
  id: string;
  filename: string;
  upload_date: string;
  extracted?: boolean;
  numbers_count?: number;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [source, setSource] = useState('whatsapp');

  const handleUploadComplete = (uploaded: UploadedScreenshot[]) => {
    setScreenshots(prev => [...prev, ...uploaded]);
  };

  const handleExtractAll = async () => {
    if (screenshots.length === 0) return;

    setExtracting(true);

    try {
      const ids = screenshots.filter(s => !s.extracted).map(s => s.id);

      for (const id of ids) {
        try {
          const result = await extractFromScreenshot(id, source);
          setScreenshots(prev =>
            prev.map(s =>
              s.id === id
                ? { ...s, extracted: true, numbers_count: result.numbers_found }
                : s
            )
          );
        } catch (error) {
          setScreenshots(prev =>
            prev.map(s =>
              s.id === id
                ? { ...s, error: 'Extraction failed' }
                : s
            )
          );
        }
      }
    } finally {
      setExtracting(false);
    }
  };

  const allExtracted = screenshots.length > 0 &&
    screenshots.every(s => s.extracted || s.error);

  const totalNumbers = screenshots.reduce((sum, s) => sum + (s.numbers_count || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Screenshots</h1>
        <p className="text-gray-500 mt-1">
          Upload WhatsApp screenshots to extract phone numbers
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Files</CardTitle>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-500">Source:</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="call_log">Call Log</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScreenshotUploader
            onUploadComplete={handleUploadComplete}
            source={source}
          />
        </CardContent>
      </Card>

      {screenshots.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Uploaded Screenshots ({screenshots.length})
              </CardTitle>
              <Button
                onClick={handleExtractAll}
                disabled={extracting || allExtracted}
                loading={extracting}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {extracting ? 'Extracting...' : 'Extract All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {screenshots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {s.extracted ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : s.error ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className="text-sm text-gray-700">{s.filename}</span>
                  </div>
                  <div className="text-sm">
                    {s.extracted && (
                      <span className="text-green-600 font-medium">
                        {s.numbers_count} numbers found
                      </span>
                    )}
                    {s.error && (
                      <span className="text-red-500">{s.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allExtracted && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-800 font-medium">
                      Extraction Complete!
                    </p>
                    <p className="text-green-600 text-sm">
                      Found {totalNumbers} phone numbers from {screenshots.length} screenshots
                    </p>
                  </div>
                  <Button onClick={() => router.push('/numbers')}>
                    View Numbers
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
