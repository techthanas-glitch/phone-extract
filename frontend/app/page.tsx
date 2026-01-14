'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Image, Phone, Users, GitCompare,
  Upload, ArrowRight, CheckCircle, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import StatsCard from '@/components/StatsCard';
import Button from '@/components/ui/Button';
import { getScreenshots, getNumbersStats, getComparisonStats } from '@/lib/api';

interface DashboardStats {
  screenshots: { total: number; processed: number; unprocessed: number };
  numbers: { total: number; valid: number; invalid: number; byCountry: any[] };
  comparison: { total: number; new: number; existing: number; matchRate: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [screenshotsRes, numbersRes, comparisonRes] = await Promise.all([
          getScreenshots(1, 1).catch(() => ({ total: 0, items: [] })),
          getNumbersStats().catch(() => ({ total: 0, valid: 0, invalid: 0, by_country: [] })),
          getComparisonStats().catch(() => ({
            total_extracted: 0,
            new_numbers: 0,
            exact_matches: 0,
            partial_matches: 0,
            match_rate: 0
          }))
        ]);

        // Count processed/unprocessed
        const allScreenshots = await getScreenshots(1, 1000).catch(() => ({ items: [] }));
        const processed = allScreenshots.items?.filter((s: any) => s.processed).length || 0;
        const unprocessed = allScreenshots.items?.filter((s: any) => !s.processed).length || 0;

        setStats({
          screenshots: {
            total: screenshotsRes.total || 0,
            processed,
            unprocessed
          },
          numbers: {
            total: numbersRes.total || 0,
            valid: numbersRes.valid || 0,
            invalid: numbersRes.invalid || 0,
            byCountry: numbersRes.by_country || []
          },
          comparison: {
            total: comparisonRes.total_extracted || 0,
            new: comparisonRes.new_numbers || 0,
            existing: (comparisonRes.exact_matches || 0) + (comparisonRes.partial_matches || 0),
            matchRate: comparisonRes.match_rate || 0
          }
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Extract and manage phone numbers from screenshots
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Screenshots
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Screenshots"
          value={stats?.screenshots.total || 0}
          subtitle={`${stats?.screenshots.processed || 0} processed`}
          icon={Image}
          color="blue"
        />
        <StatsCard
          title="Extracted Numbers"
          value={stats?.numbers.total || 0}
          subtitle={`${stats?.numbers.valid || 0} valid`}
          icon={Phone}
          color="green"
        />
        <StatsCard
          title="New Numbers"
          value={stats?.comparison.new || 0}
          subtitle="Not in existing database"
          icon={Users}
          color="purple"
        />
        <StatsCard
          title="Match Rate"
          value={`${stats?.comparison.matchRate || 0}%`}
          subtitle={`${stats?.comparison.existing || 0} matches found`}
          icon={GitCompare}
          color="yellow"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Screenshots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm mb-4">
              Upload WhatsApp screenshots to extract phone numbers automatically.
            </p>
            <Link href="/upload">
              <Button variant="outline" className="w-full">
                Go to Upload
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm mb-4">
              Import existing contacts from Zoho CRM CSV export for comparison.
            </p>
            <Link href="/import">
              <Button variant="outline" className="w-full">
                Import CSV
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compare Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm mb-4">
              Find new numbers not in your existing contact database.
            </p>
            <Link href="/compare">
              <Button variant="outline" className="w-full">
                Run Comparison
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Country Breakdown */}
      {stats?.numbers.byCountry && stats.numbers.byCountry.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Numbers by Country</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {stats.numbers.byCountry.slice(0, 6).map((country: any) => (
                <div
                  key={country.country_code}
                  className="bg-gray-50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl mb-2">{getFlag(country.country_code)}</div>
                  <div className="text-lg font-bold text-gray-900">{country.count}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {country.country_name}
                  </div>
                </div>
              ))}
            </div>
            {stats.numbers.byCountry.length > 6 && (
              <Link
                href="/numbers/by-country"
                className="mt-4 inline-block text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View all countries →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Indicators */}
      {stats && (
        <div className="flex items-center justify-center space-x-8 py-4">
          {stats.screenshots.unprocessed > 0 ? (
            <div className="flex items-center text-yellow-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{stats.screenshots.unprocessed} screenshots need processing</span>
            </div>
          ) : stats.screenshots.total > 0 ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>All screenshots processed</span>
            </div>
          ) : (
            <div className="flex items-center text-gray-500">
              <Upload className="h-5 w-5 mr-2" />
              <span>Upload screenshots to get started</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    '+1': '🇺🇸',
    '+91': '🇮🇳',
    '+44': '🇬🇧',
    '+61': '🇦🇺',
    '+971': '🇦🇪',
    '+92': '🇵🇰',
    '+880': '🇧🇩',
  };
  return flags[countryCode] || '🌍';
}
