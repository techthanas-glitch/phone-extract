'use client';

import { useEffect, useState } from 'react';
import { GitCompare, Download, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatsCard from '@/components/StatsCard';
import NumbersTable from '@/components/NumbersTable';
import {
  runComparison,
  getComparisonStats,
  getNewNumbers,
  getExportUrl,
  ComparisonStats,
  ExtractedNumber
} from '@/lib/api';

export default function ComparePage() {
  const [stats, setStats] = useState<ComparisonStats | null>(null);
  const [newNumbers, setNewNumbers] = useState<ExtractedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [page]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsResult, numbersResult] = await Promise.all([
        getComparisonStats(),
        getNewNumbers(page, 50)
      ]);
      setStats(statsResult);
      setNewNumbers(numbersResult.items || []);
      setTotalPages(numbersResult.pages || 1);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunComparison() {
    setComparing(true);
    try {
      await runComparison();
      await loadData();
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setComparing(false);
    }
  }

  const handleExportNew = () => {
    window.open(getExportUrl('new-numbers'), '_blank');
  };

  const handleExportAll = () => {
    window.open(getExportUrl('comparison'), '_blank');
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Compare Numbers</h1>
          <p className="text-gray-500 mt-1">
            Find new numbers not in your existing contact database
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportNew}>
            <Download className="h-4 w-4 mr-2" />
            Export New
          </Button>
          <Button onClick={handleRunComparison} loading={comparing}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {comparing ? 'Comparing...' : 'Run Comparison'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Extracted"
          value={stats?.total_extracted || 0}
          subtitle="Phone numbers from screenshots"
          icon={GitCompare}
          color="blue"
        />
        <StatsCard
          title="Existing Contacts"
          value={stats?.total_existing_contacts || 0}
          subtitle="Imported from CSV"
          icon={CheckCircle}
          color="green"
        />
        <StatsCard
          title="New Numbers"
          value={stats?.new_numbers || 0}
          subtitle="Not in existing database"
          icon={AlertCircle}
          color="purple"
        />
        <StatsCard
          title="Match Rate"
          value={`${stats?.match_rate || 0}%`}
          subtitle={`${(stats?.exact_matches || 0) + (stats?.partial_matches || 0)} matches`}
          icon={CheckCircle}
          color="yellow"
        />
      </div>

      {/* Comparison Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Comparison Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats?.exact_matches || 0}
              </div>
              <div className="text-sm text-green-800">Exact Matches</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.partial_matches || 0}
              </div>
              <div className="text-sm text-yellow-800">Partial Matches</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats?.new_numbers || 0}
              </div>
              <div className="text-sm text-purple-800">New Numbers</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats?.not_compared || 0}
              </div>
              <div className="text-sm text-gray-800">Not Compared</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Numbers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              New Numbers ({stats?.new_numbers || 0})
            </CardTitle>
            <Badge variant="info">Not in existing database</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {newNumbers.length > 0 ? (
            <NumbersTable
              numbers={newNumbers}
              showActions={true}
            />
          ) : (
            <div className="py-12 text-center text-gray-500">
              {stats?.total_extracted === 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No extracted numbers to compare</p>
                  <p className="text-sm">Upload screenshots first</p>
                </>
              ) : stats?.total_existing_contacts === 0 ? (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No existing contacts to compare against</p>
                  <p className="text-sm">Import a CSV file first</p>
                </>
              ) : (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>All numbers match existing contacts!</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
