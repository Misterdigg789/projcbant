import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApiRequest } from '@/lib/adminApi';
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Wallet, 
  TrendingUp, 
  Send, 
  Download, 
  Upload, 
  History,
  DollarSign,
  Zap,
  Gift,
  Award,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WalletData {
  balance: number;
  totalCommission: number;
  totalBonusesGiven: number;
  transactions: Transaction[];
}

interface Transaction {
  id: number;
  type: 'fund_load' | 'bonus_sent' | 'commission_earned' | 'withdrawal';
  amount: string;
  description: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
  relatedId?: number;
  relatedType?: string;
}

export default function AdminWallet() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadAmount, setLoadAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Fetch wallet data
  const { data: wallet, isLoading, refetch } = useQuery<WalletData>({
    queryKey: ['/api/admin/wallet'],
    queryFn: async () => {
      return adminApiRequest('/api/admin/wallet', { credentials: 'include' });
    },
  });

  // Load funds mutation (initializes Paystack)
  const loadFundsMutation = useMutation({
    mutationFn: async (amount: number) => {
      return adminApiRequest('/api/admin/wallet/load', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ amount, reference: `load_${Date.now()}` }),
      });
    },
    onSuccess: (data: any) => {
      if (data.authorization_url && data.reference) {
        // Open payment modal with Paystack iframe
        setPaymentUrl(data.authorization_url);
        setPaymentReference(data.reference);
        setIsPaymentModalOpen(true);
        setShowLoadModal(false);
      } else {
        toast({ 
          title: '❌ Error', 
          description: 'Unable to initialize payment. Please try again.',
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: '❌ Error', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  // Withdraw funds mutation
  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      return adminApiRequest('/api/admin/wallet/withdraw', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: (data) => {
      toast({ 
        title: '✅ Withdrawal Initiated', 
        description: `₦${parseFloat(withdrawAmount).toLocaleString()} is pending to your bank account. ${data.note}`,
      });
      setWithdrawAmount('');
      setShowWithdrawModal(false);
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: '❌ Error', 
        description: error.message,
        variant: 'destructive'
      });
    },
  });

  const handleLoadFunds = () => {
    const amount = parseFloat(loadAmount);
    if (!amount || amount <= 0) {
      toast({ 
        title: 'Invalid Amount', 
        description: 'Please enter a valid amount',
        variant: 'destructive'
      });
      return;
    }
    loadFundsMutation.mutate(amount);
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({ 
        title: 'Invalid Amount', 
        description: 'Please enter a valid amount',
        variant: 'destructive'
      });
      return;
    }
    if (wallet && amount > wallet.balance) {
      toast({ 
        title: 'Insufficient Balance', 
        description: `You only have ₦${wallet.balance.toLocaleString()}`,
        variant: 'destructive'
      });
      return;
    }
    withdrawMutation.mutate(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'fund_load':
        return <Download className="w-4 h-4 text-green-400" />;
      case 'bonus_sent':
        return <Gift className="w-4 h-4 text-purple-400" />;
      case 'commission_earned':
        return <TrendingUp className="w-4 h-4 text-blue-400" />;
      case 'withdrawal':
        return <Upload className="w-4 h-4 text-orange-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTransactions = wallet?.transactions.filter(t => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  }) || [];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin">
            <Wallet className="w-8 h-8 text-slate-400" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-8 h-8 text-purple-400" />
              Admin Wallet
            </h1>
            <p className="text-slate-400 mt-1">Manage funds, bonuses, and payouts</p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="border-slate-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Balance Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-300 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                ₦{wallet?.balance.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Available funds</p>
            </CardContent>
          </Card>

          {/* Commission Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-300 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Total Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                ₦{wallet?.totalCommission.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Lifetime earnings</p>
            </CardContent>
          </Card>

          {/* Bonuses Given Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-300 text-sm flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-400" />
                Total Bonuses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">
                ₦{wallet?.totalBonusesGiven.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-slate-400 mt-1">Distributed to users</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-300 flex items-center gap-2">
                <Download className="w-5 h-5 text-green-400" />
                Load Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-400">
                Add funds from Paystack to your admin wallet for bonuses
              </p>
              <Button
                onClick={() => setShowLoadModal(true)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Load Funds
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-300 flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-400" />
                Withdraw Funds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-400">
                Withdraw funds to your bank account via Paystack
              </p>
              <Button
                onClick={() => setShowWithdrawModal(true)}
                variant="outline"
                className="w-full border-orange-600 text-orange-400 hover:bg-orange-900/30"
              >
                <Send className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Transaction History
              </CardTitle>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 bg-slate-700 border-slate-600">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="fund_load">Fund Loads</SelectItem>
                  <SelectItem value="bonus_sent">Bonuses Sent</SelectItem>
                  <SelectItem value="commission_earned">Commissions</SelectItem>
                  <SelectItem value="withdrawal">Withdrawals</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No transactions yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-slate-700 rounded-full p-2">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">
                          {tx.type === 'fund_load' && '💰 Load Funds'}
                          {tx.type === 'bonus_sent' && '🎁 Bonus Sent'}
                          {tx.type === 'commission_earned' && '📈 Commission Earned'}
                          {tx.type === 'withdrawal' && '💳 Withdrawal'}
                        </p>
                        <p className="text-xs text-slate-400">{tx.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className={`font-bold text-sm ${tx.type === 'fund_load' || tx.type === 'commission_earned' ? 'text-green-400' : 'text-orange-400'}`}>
                        {tx.type === 'fund_load' || tx.type === 'commission_earned' ? '+' : '-'}₦{Math.abs(parseFloat(tx.amount)).toLocaleString()}
                      </p>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Load Funds Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="text-white">Load Funds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Amount (₦)</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={loadAmount}
                  onChange={(e) => setLoadAmount(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  min="1"
                />
              </div>
              <div className="bg-slate-700/50 p-3 rounded text-sm text-slate-300">
                <p>💡 You will be redirected to Paystack to complete the payment.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLoadModal(false)}
                  className="border-slate-600 flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleLoadFunds}
                  disabled={loadFundsMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 flex-1"
                >
                  {loadFundsMutation.isPending ? 'Processing...' : 'Load Funds'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle className="text-white">Withdraw Funds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Amount (₦)</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                  min="1"
                  max={wallet?.balance}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Available: ₦{wallet?.balance.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-slate-700/50 p-3 rounded text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200">📤 Withdrawal Process:</p>
                <ul className="text-xs space-y-1 ml-2">
                  <li>✓ Funds deducted from your admin wallet</li>
                  <li>✓ Transfer initiated to your registered bank account</li>
                  <li>✓ 1-3 business days for funds to arrive</li>
                  <li>✓ Your bank may charge processing fees</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowWithdrawModal(false)}
                  className="border-slate-600 flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 flex-1"
                >
                  {withdrawMutation.isPending ? 'Processing...' : 'Withdraw'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Modal with Iframe */}
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          if (!open && paymentReference) {
            // When modal closes, verify payment
            toast({
              title: "Verifying Payment",
              description: "Please wait while we verify your payment...",
            });

            (async () => {
              try {
                const data = await adminApiRequest('/api/admin/wallet/verify-payment', {
                  method: 'POST',
                  credentials: 'include',
                  body: JSON.stringify({ reference: paymentReference }),
                });

                toast({
                  title: 'Payment Verified',
                  description: data?.message || 'Your deposit has been credited to your account!',
                });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/wallet'] });
                setLoadAmount('');
                setShowLoadModal(false);
              } catch (error: any) {
                const msg = (error.message || '').toLowerCase();
                if (msg.includes('success') || msg.includes('verified')) {
                  toast({ title: 'Payment Verified', description: 'Your deposit has been credited to your account!' });
                  queryClient.invalidateQueries({ queryKey: ['/api/admin/wallet'] });
                  setLoadAmount('');
                  setShowLoadModal(false);
                } else {
                  toast({ title: 'Payment Pending', description: "We'll verify your payment shortly." });
                }
              }
            })();
          }
          setIsPaymentModalOpen(open);
          if (!open) {
            setPaymentUrl(null);
            setPaymentReference(null);
          }
        }}
      >
        <DialogContent className="max-w-md w-[95vw] sm:w-full h-[600px] sm:h-[650px] p-0 bg-transparent border-0 overflow-hidden">
          <DialogTitle className="sr-only">Payment Checkout</DialogTitle>
          <DialogDescription className="sr-only">
            Complete your payment securely with Paystack
          </DialogDescription>
          {paymentUrl && (
            <iframe
              src={paymentUrl}
              className="w-full h-full border-0 rounded-2xl"
              title="Payment"
              allow="payment"
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
