import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DailyPnL,
  ChallengeAnalytics,
  TreasuryMetrics,
  PerformanceByUser,
  RiskAnalysis,
} from '@/types/treasury';

interface TreasuryAnalyticsDashboardProps {
  adminId: string;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export const TreasuryAnalyticsDashboard: React.FC<TreasuryAnalyticsDashboardProps> = ({
  adminId,
}) => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // Fetch metrics
  const { data: metrics } = useQuery({
    queryKey: ['treasuryMetrics', adminId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/treasury/analytics/metrics?adminId=${adminId}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json() as Promise<TreasuryMetrics>;
    },
    refetchInterval: 30000,
  });

  // Fetch daily trends
  const { data: dailyTrends } = useQuery({
    queryKey: ['treasuryDailyTrends', dateRange, adminId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/treasury/analytics/daily-trends?range=${dateRange}&adminId=${adminId}`
      );
      if (!res.ok) throw new Error('Failed to fetch daily trends');
      return res.json() as Promise<DailyPnL[]>;
    },
    refetchInterval: 30000,
  });

  // Fetch challenge analytics
  const { data: challengeAnalytics } = useQuery({
    queryKey: ['treasuryChallengeAnalytics', adminId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/treasury/analytics/challenges?adminId=${adminId}`);
      if (!res.ok) throw new Error('Failed to fetch challenge analytics');
      return res.json() as Promise<ChallengeAnalytics[]>;
    },
    refetchInterval: 30000,
  });

  // Fetch user performance
  const { data: userPerformance } = useQuery({
    queryKey: ['treasuryUserPerformance', adminId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/treasury/analytics/user-performance?adminId=${adminId}`);
      if (!res.ok) throw new Error('Failed to fetch user performance');
      return res.json() as Promise<PerformanceByUser[]>;
    },
    refetchInterval: 30000,
  });

  // Fetch risk analysis
  const { data: riskAnalysis } = useQuery({
    queryKey: ['treasuryRiskAnalysis', adminId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/treasury/analytics/risk-analysis?adminId=${adminId}`);
      if (!res.ok) throw new Error('Failed to fetch risk analysis');
      return res.json() as Promise<RiskAnalysis[]>;
    },
    refetchInterval: 30000,
  });

  const handleExport = async () => {
    const res = await fetch(`/api/admin/treasury/analytics/export?format=${exportFormat}&adminId=${adminId}`);
    if (!res.ok) return;

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treasury-analytics-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (!metrics || !dailyTrends || !challengeAnalytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const netPnLColor = metrics.total_net_pnl >= 0 ? 'text-green-600' : 'text-red-600';
  const winRateColor = metrics.overall_win_rate >= 50 ? 'text-green-600' : 'text-red-600';

  // Prepare data for win/loss pie chart
  const winLossData = [
    { name: 'Wins', value: metrics.total_matches_settled * (metrics.overall_win_rate / 100) },
    { name: 'Losses', value: metrics.total_matches_settled * (1 - metrics.overall_win_rate / 100) },
  ];

  // Prepare top/bottom challenges data
  const topChallenges = challengeAnalytics
    .sort((a, b) => b.net_pnl - a.net_pnl)
    .slice(0, 5);

  const bottomChallenges = challengeAnalytics
    .sort((a, b) => a.net_pnl - b.net_pnl)
    .slice(0, 5);

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Treasury Analytics</h1>
          <p className="text-muted-foreground mt-1">Real-time performance metrics and insights</p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={(val: any) => setDateRange(val)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={exportFormat} onValueChange={(val: any) => setExportFormat(val)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV Export</SelectItem>
              <SelectItem value="json">JSON Export</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_matches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.pending_settlement} pending settlement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${winRateColor}`}>
              {metrics.overall_win_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(metrics.total_matches_settled * (metrics.overall_win_rate / 100))} wins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Net P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netPnLColor}`}>
              ₦{(metrics.total_net_pnl / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.days_active} days active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Match Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{(metrics.avg_match_size / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ₦{(metrics.total_amount_wagered / 1000000).toFixed(1)}M total wagered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Tabs */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Daily Trends
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="risk">
            <Activity className="h-4 w-4 mr-2" />
            Risk Analysis
          </TabsTrigger>
        </TabsList>

        {/* Daily Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily P&L Trend</CardTitle>
              <CardDescription>Net profit/loss by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `₦${value?.toLocaleString()}`}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="net_pnl"
                    stroke="#10b981"
                    name="Net P&L"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Match Volume</CardTitle>
              <CardDescription>Matches settled per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="wins" stackId="a" fill="#10b981" name="Wins" />
                  <Bar dataKey="losses" stackId="a" fill="#ef4444" name="Losses" />
                  <Bar dataKey="draws" stackId="a" fill="#f59e0b" name="Draws" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Win/Loss Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toFixed(0)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toFixed(0)} matches`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Days</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.most_profitable_day && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Most Profitable</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {metrics.most_profitable_day.date}
                      </span>
                      <span className="text-green-600 font-semibold">
                        +₦{(metrics.most_profitable_day.net_pnl / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.most_profitable_day.matches_count} matches
                    </p>
                  </div>
                )}
                {metrics.most_challenging_day && (
                  <div className="space-y-1 mt-4">
                    <p className="text-sm font-medium">Most Challenging</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {metrics.most_challenging_day.date}
                      </span>
                      <span className="text-red-600 font-semibold">
                        {metrics.most_challenging_day.net_pnl < 0 ? '-' : '+'}
                        ₦{Math.abs(metrics.most_challenging_day.net_pnl / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.most_challenging_day.matches_count} matches
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top/Bottom Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 5 Challenges</CardTitle>
                <CardDescription>Most profitable</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topChallenges.map((ch, idx) => (
                  <div key={ch.challenge_id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{idx + 1}. {ch.challenge_title}</p>
                      <p className="text-xs text-muted-foreground">{ch.total_matches} matches</p>
                    </div>
                    <Badge className="ml-2 bg-green-100 text-green-800">
                      +₦{(ch.net_pnl / 1000).toFixed(0)}K
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bottom 5 Challenges</CardTitle>
                <CardDescription>Needs attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bottomChallenges.map((ch, idx) => (
                  <div key={ch.challenge_id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{idx + 1}. {ch.challenge_title}</p>
                      <p className="text-xs text-muted-foreground">{ch.total_matches} matches</p>
                    </div>
                    <Badge className="ml-2 bg-red-100 text-red-800">
                      -₦{Math.abs(ch.net_pnl / 1000).toFixed(0)}K
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Analysis Tab */}
        <TabsContent value="risk" className="space-y-4">
          {riskAnalysis && riskAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Risk Exposure Timeline</CardTitle>
                <CardDescription>Daily risk utilization and exposure</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={riskAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="risk_utilization"
                      stroke="#f59e0b"
                      name="Risk Utilization %"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Risk Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Highest Single Day Risk</span>
                <span className="font-semibold">
                  ₦{(riskAnalysis?.[0]?.max_daily_risk / 1000 || 0).toFixed(0)}K
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Highest Single Day Loss</span>
                <span className="font-semibold text-red-600">
                  -₦{Math.max(...(riskAnalysis?.map((r) => r.actual_daily_loss) || [0])) / 1000}K
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Exposed</span>
                <span className="font-semibold">
                  ₦{(riskAnalysis?.reduce((sum, r) => sum + r.total_exposed, 0) || 0) / 1000}K
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Performance Table */}
      {userPerformance && userPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>User Performance</CardTitle>
            <CardDescription>Real vs Shadow personas performance breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Username</th>
                    <th className="text-right py-2">Matches</th>
                    <th className="text-right py-2">Win Rate</th>
                    <th className="text-right py-2">Wagered</th>
                    <th className="text-right py-2">Payout</th>
                    <th className="text-right py-2">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {userPerformance.slice(0, 10).map((user) => (
                    <tr key={user.user_id} className="border-b">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span>{user.username}</span>
                          {user.is_shadow && <Badge variant="outline">Shadow</Badge>}
                        </div>
                      </td>
                      <td className="text-right">{user.matches_count}</td>
                      <td className="text-right">{user.win_rate.toFixed(1)}%</td>
                      <td className="text-right">₦{(user.total_wagered / 1000).toFixed(0)}K</td>
                      <td className="text-right">₦{(user.total_payout / 1000).toFixed(0)}K</td>
                      <td className={`text-right font-semibold ${user.net_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {user.net_pnl >= 0 ? '+' : ''}₦{(user.net_pnl / 1000).toFixed(0)}K
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TreasuryAnalyticsDashboard;
