import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import AdminLayout from "@/components/AdminLayout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Gift,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
  Users
} from 'lucide-react';

const bonusConfigSchema = z.object({
  bonusType: z.enum(['platform_daily', 'streak_bonus', 'challenge_bonus', 'referral_bonus', 'event_bonus']),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be positive"),
  multiplier: z.string().refine((val) => parseFloat(val) > 0, "Multiplier must be positive"),
  condition: z.string().min(5, "Condition description required"),
  maxUses: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  active: z.boolean().default(true),
});

type BonusFormData = z.infer<typeof bonusConfigSchema>;

interface ActiveBonus {
  id: number;
  bonusType: string;
  amount: number;
  multiplier: number;
  condition: string;
  maxUses: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
}

export default function AdminBonusConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeBonuses, setActiveBonuses] = useState<ActiveBonus[]>([]);
  const [isAddingBonus, setIsAddingBonus] = useState(false);

  const form = useForm<BonusFormData>({
    resolver: zodResolver(bonusConfigSchema),
    defaultValues: {
      bonusType: 'platform_daily',
      amount: '',
      multiplier: '1',
      condition: '',
      maxUses: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      active: true,
    },
  });

  const createBonus = useMutation({
    mutationFn: async (data: BonusFormData) => {
      return apiRequest('POST', '/api/admin/bonuses', {
        ...data,
        amount: parseFloat(data.amount),
        multiplier: parseFloat(data.multiplier),
        maxUses: data.maxUses ? parseInt(data.maxUses) : null,
      });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Bonus Created',
        description: `${data.bonusType} bonus activated`,
      });
      setActiveBonuses([...activeBonuses, data]);
      setIsAddingBonus(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateBonus = useMutation({
    mutationFn: async ({ bonusId, active }: { bonusId: number; active: boolean }) => {
      return apiRequest('PATCH', `/api/admin/bonuses/${bonusId}`, { active });
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Bonus Updated',
        description: `Bonus ${data.active ? 'activated' : 'deactivated'}`,
      });
      setActiveBonuses(activeBonuses.map(b => b.id === data.id ? data : b));
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: BonusFormData) => {
    createBonus.mutate(data);
  };

  const getBonusIcon = (type: string) => {
    switch (type) {
      case 'platform_daily': return '☀️';
      case 'streak_bonus': return '🔥';
      case 'challenge_bonus': return '🎯';
      case 'referral_bonus': return '👥';
      case 'event_bonus': return '🏆';
      default: return '🎁';
    }
  };

  const getBonusLabel = (type: string) => {
    switch (type) {
      case 'platform_daily': return 'Daily Login';
      case 'streak_bonus': return 'Winning Streak';
      case 'challenge_bonus': return 'Challenge Victory';
      case 'referral_bonus': return 'Referral Reward';
      case 'event_bonus': return 'Event Participation';
      default: return type;
    }
  };

  const calculateTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Expired';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Bonus Configuration</h1>
            <p className="text-slate-400">Create and manage platform bonus offers</p>
          </div>
          <Button
            onClick={() => setIsAddingBonus(!isAddingBonus)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Gift className="w-4 h-4 mr-2" />
            {isAddingBonus ? 'Cancel' : 'New Bonus'}
          </Button>
        </div>

        {/* Active Bonuses Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Bonuses</p>
                  <p className="text-2xl font-bold text-green-400">
                    {activeBonuses.filter(b => b.active).length}
                  </p>
                </div>
                <Gift className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Bonuses</p>
                  <p className="text-2xl font-bold text-blue-400">{activeBonuses.length}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Distributed</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ₦{activeBonuses.reduce((sum, b) => sum + (b.amount * b.usedCount), 0).toLocaleString()}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Uses This Week</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {activeBonuses.reduce((sum, b) => sum + b.usedCount, 0)}
                  </p>
                </div>
                <Users className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Bonus Form */}
        {isAddingBonus && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Create New Bonus</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Bonus Type */}
                  <FormField
                    control={form.control}
                    name="bonusType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Bonus Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            <SelectItem value="platform_daily">☀️ Daily Login Bonus</SelectItem>
                            <SelectItem value="streak_bonus">🔥 Winning Streak Bonus</SelectItem>
                            <SelectItem value="challenge_bonus">🎯 Challenge Victory Bonus</SelectItem>
                            <SelectItem value="referral_bonus">👥 Referral Reward</SelectItem>
                            <SelectItem value="event_bonus">🏆 Event Participation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount & Multiplier Row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Base Amount (₦) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="100"
                              placeholder="500"
                              {...field}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="multiplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Multiplier (for winners) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="1.5"
                              {...field}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </FormControl>
                          <p className="text-xs text-slate-400 mt-1">e.g., 1.5 = 150% bonus</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Condition */}
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Condition/Description *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Win 3 challenges in a row, Complete daily login streak, etc."
                            {...field}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Uses */}
                  <FormField
                    control={form.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Max Uses Per User (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Leave blank for unlimited"
                            {...field}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date Range */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Start Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">End Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={createBonus.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {createBonus.isPending ? 'Creating...' : '✓ Create Bonus'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddingBonus(false)}
                      className="border-slate-600 text-slate-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Active Bonuses List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Active & Scheduled Bonuses</h2>
          {activeBonuses.length === 0 ? (
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-8 text-center">
                <Gift className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
                <p className="text-slate-400">No bonuses configured yet</p>
                <p className="text-sm text-slate-500 mt-2">Create one to incentivize player engagement</p>
              </CardContent>
            </Card>
          ) : (
            activeBonuses.map((bonus) => (
              <Card key={bonus.id} className="bg-slate-900 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{getBonusIcon(bonus.bonusType)}</span>
                        <div>
                          <h3 className="text-white font-semibold">{getBonusLabel(bonus.bonusType)}</h3>
                          <Badge className={bonus.active ? 'bg-green-600' : 'bg-gray-600'}>
                            {bonus.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-slate-300 text-sm mb-3">{bonus.condition}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-800 p-3 rounded-lg">
                        <div>
                          <p className="text-xs text-slate-400">Amount</p>
                          <p className="text-white font-semibold">₦{bonus.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Multiplier</p>
                          <p className="text-white font-semibold">{(bonus.multiplier * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Used</p>
                          <p className="text-yellow-400 font-semibold">
                            {bonus.usedCount}{bonus.maxUses ? `/${bonus.maxUses}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Expires</p>
                          <p className="text-white font-semibold text-xs">{calculateTimeRemaining(bonus.endDate)}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => updateBonus.mutate({ bonusId: bonus.id, active: !bonus.active })}
                      disabled={updateBonus.isPending}
                      variant="outline"
                      className="border-slate-600 text-slate-300 ml-4"
                    >
                      {bonus.active ? '🔴 Deactivate' : '🟢 Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-slate-900 border-blue-700 border-2">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-2">
                <p className="text-blue-300 font-semibold">How Bonuses Work</p>
                <ul className="text-blue-200 text-xs space-y-1">
                  <li>✓ Bonuses are automatically awarded when conditions are met</li>
                  <li>✓ Multipliers increase payouts for winning users</li>
                  <li>✓ Max Uses limits prevent abuse and control costs</li>
                  <li>✓ Inactive bonuses don't award but remain in history</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
