'use client';

import { useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { ExtractedNumber } from '@/lib/api';
import { getCountryFlag, formatDate } from '@/lib/utils';

interface NumbersTableProps {
  numbers: ExtractedNumber[];
  onSelect?: (ids: string[]) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
  loading?: boolean;
}

export default function NumbersTable({
  numbers,
  onSelect,
  onDelete,
  showActions = true,
  loading = false
}: NumbersTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
    onSelect?.(Array.from(newSelected));
  };

  const toggleSelectAll = () => {
    if (selected.size === numbers.length) {
      setSelected(new Set());
      onSelect?.([]);
    } else {
      const allIds = numbers.map(n => n.id);
      setSelected(new Set(allIds));
      onSelect?.(allIds);
    }
  };

  const copyNumber = async (number: string, id: string) => {
    await navigator.clipboard.writeText(number);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (numbers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No numbers found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelect && (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={selected.size === numbers.length && numbers.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Number
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Country
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Groups
            </th>
            {showActions && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {numbers.map((num) => (
            <tr key={num.id} className="hover:bg-gray-50">
              {onSelect && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(num.id)}
                    onChange={() => toggleSelect(num.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="font-mono text-sm">
                  {num.normalized_number || num.raw_number}
                </div>
                {num.normalized_number && num.raw_number !== num.normalized_number && (
                  <div className="text-xs text-gray-400">{num.raw_number}</div>
                )}
                {num.carrier && (
                  <div className="text-xs text-gray-400">{num.carrier}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <span className="text-lg mr-2">{getCountryFlag(num.country_code)}</span>
                  <div>
                    <div className="text-sm">{num.country_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-400">{num.country_code}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {num.is_valid ? (
                    <Badge variant="success" size="sm">Valid</Badge>
                  ) : (
                    <Badge variant="danger" size="sm">Invalid</Badge>
                  )}
                  {num.comparison_status === 'new' && (
                    <Badge variant="info" size="sm">New</Badge>
                  )}
                  {num.comparison_status === 'existing' && (
                    <Badge variant="default" size="sm">Existing</Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {num.groups.map(g => (
                    <span
                      key={g.id}
                      className="px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </td>
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyNumber(num.normalized_number || num.raw_number, num.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Copy number"
                    >
                      {copiedId === num.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(num.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete number"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
