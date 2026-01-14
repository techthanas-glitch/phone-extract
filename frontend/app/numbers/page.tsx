'use client';

import { useEffect, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import NumbersTable from '@/components/NumbersTable';
import { getNumbers, getExportUrl, ExtractedNumber } from '@/lib/api';

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<ExtractedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [validFilter, setValidFilter] = useState<string>('');

  useEffect(() => {
    loadNumbers();
  }, [page, countryFilter, validFilter]);

  async function loadNumbers() {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (countryFilter) params.country_code = countryFilter;
      if (validFilter !== '') params.is_valid = validFilter === 'true';
      if (search) params.search = search;

      const result = await getNumbers(params);
      setNumbers(result.items || []);
      setTotalPages(result.pages || 1);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Failed to load numbers:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setPage(1);
    loadNumbers();
  };

  const handleExport = () => {
    window.open(getExportUrl('numbers'), '_blank');
  };

  // Get unique countries from current results for filter dropdown
  const countries = [...new Set(numbers.map(n => n.country_code).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Extracted Numbers</h1>
          <p className="text-gray-500 mt-1">
            {total} phone numbers extracted from screenshots
          </p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search numbers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Countries</option>
              <option value="+1">United States (+1)</option>
              <option value="+91">India (+91)</option>
              <option value="+44">United Kingdom (+44)</option>
              <option value="+971">UAE (+971)</option>
              <option value="+92">Pakistan (+92)</option>
              <option value="+880">Bangladesh (+880)</option>
            </select>

            <select
              value={validFilter}
              onChange={(e) => {
                setValidFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="true">Valid Only</option>
              <option value="false">Invalid Only</option>
            </select>

            <Button variant="outline" onClick={handleSearch}>
              <Filter className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Numbers Table */}
      <Card>
        <CardContent className="p-0">
          <NumbersTable
            numbers={numbers}
            loading={loading}
            showActions={true}
          />
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
