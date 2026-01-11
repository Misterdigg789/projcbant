import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { adminApiRequest } from '@/lib/adminApi';
import AdminLayout from "@/components/AdminLayout";
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Send,
  Filter,
  Users
} from 'lucide-react';

interface PendingPayout {
  userId: string;
  username: string;
  email: string;
  profileImageUrl: string;
  pendingAmount: number;
  reasons: Array<{
    reason: 'event_win' | 'challenge_win' | 'referral_bonus' | 'streak_bonus' | 'admin_credit';
    amount: number;
    sourceId: number;
    sourceName: string;
  }>;
  totalPayouts: number;
  lastPayoutDate: string | null;
}

export default function AdminPayoutDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const { data: pendingPayouts = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/payouts/pending'],
    queryFn: async () => {
      return adminApiRequest('/api/admin/payouts/pending', { credentials: 'include' });
    },
    retry: false,
  });

  const processPayout = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      return adminApiRequest('/api/admin/payouts/process', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ userId, amount }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Payout Processed",
        description: data.message,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payouts/pending'] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Payout Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processBatchPayouts = useMutation({
    mutationFn: async (userIds: string[]) => {
      return adminApiRequest('/api/admin/payouts/batch', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ userIds }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Batch Payouts Processed",
        description: `${data.processedCount} payouts completed`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payouts/pending'] });
      setSelectedUsers(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Batch Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredPayouts = pendingPayouts.filter((payout: PendingPayout) => {
    if (filterType !== 'all') {
      const hasType = payout.reasons.some(r => r.reason === filterType);
      if (!hasType) return false;
    }
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        payout.username.toLowerCase().includes(s) ||
        payout.email.toLowerCase().includes(s) ||
        payout.userId.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalPending = filteredPayouts.reduce((sum: number, p: PendingPayout) => sum + p.pendingAmount, 0);
  const selectedTotal = filteredPayouts
    .filter(p => selectedUsers.has(p.userId))
    .reduce((sum: number, p: PendingPayout) => sum + p.pendingAmount, 0);

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const toggleAllVisible = () => {
    const newSet = new Set<string>();
    if (selectedUsers.size < filteredPayouts.length) {
      filteredPayouts.forEach((p: PendingPayout) => newSet.add(p.userId));
    }
    setSelectedUsers(newSet);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Payout Dashboard</h1>
            <p className="text-slate-400">Manage pending payouts to users</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Pending</p>
                  <p className="text-2xl font-bold text-red-400">₦{totalPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Users</p>
                  <p className="text-2xl font-bold text-yellow-400">{filteredPayouts.length}</p>
                </div>
                <Users className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Selected Amount</p>
                  <p className="text-2xl font-bold text-blue-400">₦{selectedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Selected Users</p>
                  <p className="text-2xl font-bold text-green-400">{selectedUsers.size}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Search User</label>
                <Input
                  placeholder="Username, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-2">Filter by Type</label>
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded"
                >
                  <option value="all">All Payout Types</option>
                  <option value="event_win">🏆 Event Win</option>
                  <option value="challenge_win">🎯 Challenge Win</option>
                  <option value="referral_bonus">👥 Referral Bonus</option>
                  <option value="streak_bonus">🔥 Streak Bonus</option>
                  <option value="admin_credit">➕ Admin Credit</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => toggleAllVisible()}
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  {selectedUsers.size === filteredPayouts.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={() => processBatchPayouts.mutate(Array.from(selectedUsers))}
                  disabled={selectedUsers.size === 0 || processBatchPayouts.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Process Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payouts List */}
        {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredPayouts.length === 0 ? (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
              <p className="text-slate-400">No pending payouts to process</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPayouts.map((payout: PendingPayout) => (
              <Card key={payout.userId} className="bg-slate-900 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(payout.userId)}
                      onChange={() => toggleUser(payout.userId)}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 cursor-pointer"
                    />

                    {/* User Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {payout.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-semibold">{payout.username}</p>
                          <p className="text-xs text-slate-400">{payout.email}</p>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="bg-slate-800 p-3 rounded-lg mt-2 space-y-2">
                        {payout.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {reason.reason === 'event_win' && '🏆 Event Win'}
                                {reason.reason === 'challenge_win' && '🎯 Challenge Win'}
                                {reason.reason === 'referral_bonus' && '👥 Referral'}
                                {reason.reason === 'streak_bonus' && '🔥 Streak'}
                                {reason.reason === 'admin_credit' && '➕ Admin'}
                              </Badge>
                              <span className="text-slate-300">{reason.sourceName}</span>
                            </div>
                            <span className="text-green-400 font-semibold">+₦{reason.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amount & Action */}
                    <div className="text-right space-y-3">
                      <div>
                        <p className="text-slate-400 text-xs">Pending Payout</p>
                        <p className="text-2xl font-bold text-green-400">
                          ₦{payout.pendingAmount.toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          if (confirm(`Process ₦${payout.pendingAmount.toLocaleString()} payout to ${payout.username}?`)) {
                            processPayout.mutate({
                              userId: payout.userId,
                              amount: payout.pendingAmount,
                            });
                          }
                        }}
                        disabled={processPayout.isPending}
                        className="bg-blue-600 hover:bg-blue-700 w-full"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Process
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
