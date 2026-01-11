import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminQuery } from '@/lib/adminApi';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download,
  Search
} from 'lucide-react';

export default function AdminTransactions() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [limit, setLimit] = useState(100);

  const { data: transactions = [], isLoading } = useAdminQuery(`/api/admin/transactions?limit=${limit}`, {
    retry: false,
  });

  const filtered = useMemo(() => {
    return (transactions || []).filter((t: any) => {
      // Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      
      // User search
      if (searchUser) {
        const s = searchUser.toLowerCase();
        const name = (t.username || t.email || '').toLowerCase();
        if (!name.includes(s) && !(t.userId || '').toLowerCase().includes(s)) return false;
      }

      // Amount range
      const amount = parseFloat(t.amount || '0');
      if (amountRange.min && amount < parseFloat(amountRange.min)) return false;
      if (amountRange.max && amount > parseFloat(amountRange.max)) return false;

      // Date range
      if (dateRange.start || dateRange.end) {
        const txDate = new Date(t.createdAt);
        if (dateRange.start && txDate < new Date(dateRange.start)) return false;
        if (dateRange.end && txDate > new Date(dateRange.end)) return false;
      }

      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchUser, amountRange, dateRange]);

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
    const completedAmount = filtered
      .filter((t: any) => t.status === 'completed')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
    const pendingAmount = filtered
      .filter((t: any) => t.status === 'pending')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
    
    return { totalAmount, completedAmount, pendingAmount };
  }, [filtered]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit': return '↓ Deposit';
      case 'withdrawal': return '↑ Withdrawal';
      case 'admin_credit': return '➕ Admin Credit';
      case 'admin_debit': return '➖ Admin Debit';
      default: return type;
    }
  };

  const handleExport = () => {
    const csv = [
      ['ID', 'User', 'Type', 'Amount', 'Status', 'Date'],
      ...filtered.map((t: any) => [
        t.id,
        t.username || t.email || t.userId,
        t.type,
        t.amount,
        t.status,
        new Date(t.createdAt).toLocaleString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Transactions</h1>
            <p className="text-slate-400">Monitor and filter platform transactions</p>
          </div>
          <Button onClick={handleExport} className="bg-purple-600 hover:bg-purple-700">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Volume</p>
                  <p className="text-2xl font-bold text-white">
                    ₦{stats.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{filtered.length} transactions</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-green-400">
                    ₦{stats.completedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ₦{stats.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <TrendingDown className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Type</label>
                <select 
                  value={typeFilter} 
                  onChange={(e) => setTypeFilter(e.target.value)} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">💰 Deposit</option>
                  <option value="withdrawal">🏦 Withdrawal</option>
                  <option value="admin_credit">➕ Admin Credit</option>
                  <option value="admin_debit">➖ Admin Debit</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Status</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">✓ Completed</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="failed">✗ Failed</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">User</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                  <input 
                    placeholder="Search..." 
                    value={searchUser} 
                    onChange={(e) => setSearchUser(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2 pl-8 rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Min Amount</label>
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={amountRange.min} 
                  onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Max Amount</label>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={amountRange.max} 
                  onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Start Date</label>
                <input 
                  type="date" 
                  value={dateRange.start} 
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">End Date</label>
                <input 
                  type="date" 
                  value={dateRange.end} 
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Limit</label>
                <input 
                  type="number" 
                  min={10} 
                  max={1000} 
                  value={limit} 
                  onChange={(e) => setLimit(parseInt(e.target.value || '100'))} 
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded text-sm"
                />
              </div>
            </div>

            <div className="text-xs text-slate-400 mt-3">
              Showing <span className="text-white font-semibold">{filtered.length}</span> of{' '}
              <span className="text-white font-semibold">{transactions.length}</span> transactions
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Transactions List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No transactions found matching your filters
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-3 text-slate-400">ID</th>
                      <th className="text-left p-3 text-slate-400">User</th>
                      <th className="text-left p-3 text-slate-400">Type</th>
                      <th className="text-right p-3 text-slate-400">Amount</th>
                      <th className="text-center p-3 text-slate-400">Status</th>
                      <th className="text-left p-3 text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="p-3 text-slate-300 font-mono text-xs">{t.id}</td>
                        <td className="p-3 text-slate-300">
                          <div className="text-sm">{t.username || t.email || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{t.userId}</div>
                        </td>
                        <td className="p-3 text-slate-300">{getTypeIcon(t.type)}</td>
                        <td className="p-3 text-right text-white font-semibold">
                          ₦{parseFloat(t.amount || '0').toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${getStatusColor(t.status)} border`}>
                            {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
