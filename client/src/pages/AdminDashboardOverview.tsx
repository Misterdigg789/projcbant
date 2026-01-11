import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminQuery, adminApiRequest } from "@/lib/adminApi";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  DollarSign, 
  Trophy, 
  Target, 
  Activity,
  AlertCircle,
  ArrowRight,
  Search,
  TrendingUp,
  MessageSquare,
  Zap,
  Star,
  Scale,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  Clock,
  Settings,
  Shield,
  Lock,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisWeek: number;
  totalEvents: number;
  activeEvents: number;
  completedEvents: number;
  totalChallenges: number;
  activeChallenges: number;
  completedChallenges: number;
  pendingChallenges: number;
  totalTransactions: number;
  totalVolume: number;
  totalEventPool: number;
  totalChallengeStaked: number;
  totalRevenue: number;
  totalCreatorFees: number;
  totalPlatformFees: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingPayouts: number;
  dailyActiveUsers: number;
}

interface Event {
  id: number;
  title: string;
  status: string;
  eventPool: string;
  yesPool: string;
  noPool: string;
  creatorFee: string;
  endDate: string;
  adminResult: boolean | null;
  result: boolean | null;
  createdAt: string;
  completedAt?: string;
}

interface Challenge {
  id: number;
  title: string;
  status: string;
  amount: string;
  result: string | null;
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  challengerUser?: { username: string };
  challengedUser?: { username: string };
  // Admin challenge fields
  adminCreated?: boolean;
  bonusSide?: string;
  bonusMultiplier?: string;
  bonusEndsAt?: string;
  yesStakeTotal?: number;
  noStakeTotal?: number;
}

interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  level: number;
  points: number;
  balance: string;
  createdAt: string;
  status?: string;
  isAdmin?: boolean;
}

interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function AdminDashboardOverview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [bonusSide, setBonusSide] = useState<string>("");
  const [bonusMultiplier, setBonusMultiplier] = useState<string>("1.5");
  const [bonusDuration, setBonusDuration] = useState<string>("24");

  const queryClient = useQueryClient();

  const { data: events = [] as Event[], isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events"],
    retry: false,
  });

  const { data: challenges = [] as Challenge[], isLoading: challengesLoading } = useAdminQuery("/api/admin/challenges", {
    retry: false,
  });

  const { data: adminStats = {} as AdminStats, isLoading: statsLoading } = useAdminQuery("/api/admin/stats", {
    retry: false,
  });

  const { data: recentUsers = [] as User[], isLoading: usersLoading } = useAdminQuery("/api/admin/users?limit=10", {
    retry: false,
  });

  const { data: allUsers = [] as User[], isLoading: allUsersLoading } = useAdminQuery("/api/admin/users", {
    retry: false,
  });

  const { data: escrowStats = { totalEscrow: 0, holdingAmount: 0, releasedAmount: 0, refundedAmount: 0, pendingChallenges: 0 }, isLoading: escrowLoading, error: escrowError } = useAdminQuery("/api/admin/escrow/stats", {
    retry: false,
  });

  // Mutation for activating bonuses
  const activateBonusMutation = useMutation({
    mutationFn: async (data: { challengeId: number; bonusSide: string; bonusMultiplier: number; durationHours: number }) => {
      return adminApiRequest('/api/admin/challenges/bonus', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenges"] });
      setBonusModalOpen(false);
      setSelectedChallenge(null);
      setBonusSide("");
      setBonusMultiplier("1.5");
      setBonusDuration("24");
    },
  });

  const needsEventAction = (event: Event) => {
    const endDate = new Date(event.endDate);
    const now = new Date();
    return endDate <= now && event.status === 'active' && event.adminResult === null;
  };

  const needsChallengeAction = (challenge: Challenge) => {
    return challenge.status === 'active' && challenge.dueDate && 
           new Date(challenge.dueDate) <= new Date() && !challenge.result;
  };

  // Calculate challenge imbalance
  const calculateChallengeImbalance = (challenge: Challenge) => {
    const yesStake = challenge.yesStakeTotal || 0;
    const noStake = challenge.noStakeTotal || 0;
    const totalStake = yesStake + noStake;
    
    if (totalStake === 0) return { imbalancePercent: 0, weakerSide: null };
    
    const yesPercent = (yesStake / totalStake) * 100;
    const noPercent = (noStake / totalStake) * 100;
    const imbalancePercent = Math.abs(yesPercent - noPercent);
    
    let weakerSide = null;
    if (imbalancePercent >= 20) { // 20% threshold for imbalance
      weakerSide = yesPercent < noPercent ? 'YES' : 'NO';
    }
    
    return { imbalancePercent, weakerSide };
  };

  // Open bonus activation modal
  const openBonusModal = (challenge: Challenge, suggestedSide: string) => {
    setSelectedChallenge(challenge);
    setBonusSide(suggestedSide);
    setBonusModalOpen(true);
  };

  // Handle bonus activation
  const handleActivateBonus = () => {
    if (!selectedChallenge || !bonusSide || !bonusMultiplier || !bonusDuration) return;

    activateBonusMutation.mutate({
      challengeId: selectedChallenge.id,
      bonusSide,
      bonusMultiplier: parseFloat(bonusMultiplier),
      durationHours: parseInt(bonusDuration),
    });
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter((user: User) => {
    const emailStr = typeof user.email === 'string' ? user.email : (user.email as any)?.address || '';
    return searchQuery === "" || 
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emailStr.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate stats
  const eventsNeedingAction = events.filter((e: Event) => needsEventAction(e));
  const challengesNeedingAction = challenges.filter((c: Challenge) => needsChallengeAction(c));
  const activeEvents = events.filter((e: Event) => e.status === 'active');
  const completedEvents = events.filter((e: Event) => e.status === 'completed');
  const activeChallenges = challenges.filter((c: Challenge) => c.status === 'active');
  const completedChallenges = challenges.filter((c: Challenge) => c.status === 'completed');

  const totalEventPool = events.reduce((sum: number, e: Event) => sum + parseFloat(e.eventPool || '0'), 0);
  const totalChallengeStaked = challenges.reduce((sum: number, c: Challenge) => sum + (parseFloat(c.amount) * 2), 0);
  const totalCreatorFees = events.reduce((sum: number, e: Event) => sum + parseFloat(e.creatorFee || '0'), 0);
  const totalPlatformFees = completedChallenges.reduce((sum: number, c: Challenge) => sum + (parseFloat(c.amount) * 2 * 0.05), 0);

  const isLoading = eventsLoading || challengesLoading || statsLoading;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400">Overview of platform activity and management</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Activity className="w-4 h-4 mr-1" />
              Live Monitoring
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Total Users</p>
                  <p className="text-xl font-bold text-white">{(adminStats as any).totalUsers || allUsers.length}</p>
                  <p className="text-[10px] text-green-400">+{(adminStats as any).newUsersThisWeek || 0} this week</p>
                </div>
                <Users className="w-6 h-6 text-blue-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Total Volume</p>
                  <p className="text-xl font-bold text-white">₦{((adminStats as any).totalVolume || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-blue-400">All-time trading</p>
                </div>
                <DollarSign className="w-6 h-6 text-green-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Platform Revenue</p>
                  <p className="text-xl font-bold text-white">₦{((adminStats as any).totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-purple-400">Creator + Platform fees</p>
                </div>
                <TrendingUp className="w-6 h-6 text-purple-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Active Events</p>
                  <p className="text-xl font-bold text-white">{(adminStats as any).activeEvents || 0}</p>
                  <p className="text-[10px] text-blue-400">Currently running</p>
                </div>
                <Trophy className="w-6 h-6 text-blue-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Active Challenges</p>
                  <p className="text-xl font-bold text-white">{(adminStats as any).activeChallenges || 0}</p>
                  <p className="text-[10px] text-orange-400">P2P in progress</p>
                </div>
                <Target className="w-6 h-6 text-orange-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">P2P Stakes</p>
                  <p className="text-xl font-bold text-white">₦{((adminStats as any).totalChallengeStaked || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-pink-400">Staked in challenges</p>
                </div>
                <Zap className="w-6 h-6 text-pink-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700 lg:col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Pending Actions</p>
                  <p className="text-xl font-bold text-white">{eventsNeedingAction.length + challengesNeedingAction.length}</p>
                  <p className="text-[10px] text-red-400">Need admin intervention</p>
                </div>
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">Admin Challenges</p>
                  <p className="text-xl font-bold text-white">{challenges.filter((c: Challenge) => c.adminCreated).length}</p>
                  <p className="text-[10px] text-cyan-400">Created by admin</p>
                </div>
                <Shield className="w-6 h-6 text-cyan-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-400 text-xs">User Challenges</p>
                  <p className="text-xl font-bold text-white">{challenges.filter((c: Challenge) => !c.adminCreated).length}</p>
                  <p className="text-[10px] text-indigo-400">Created by users</p>
                </div>
                <Users className="w-6 h-6 text-indigo-400 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          {!escrowError && (
            <>
              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-slate-400 text-xs">In Escrow</p>
                      <p className="text-xl font-bold text-white">₦{(Number((escrowStats as any)?.holdingAmount) || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-amber-400">{Number((escrowStats as any)?.pendingChallenges) || 0} challenges</p>
                    </div>
                    <Lock className="w-6 h-6 text-amber-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-slate-400 text-xs">Escrow Paid Out</p>
                      <p className="text-xl font-bold text-white">₦{(Number((escrowStats as any)?.releasedAmount) || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-green-400">Released to winners</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Action Required Section */}
        {(eventsNeedingAction.length > 0 || challengesNeedingAction.length > 0) && (
          <Card className="bg-red-900/20 border-red-800">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Urgent Actions Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eventsNeedingAction.length > 0 && (
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">Events Needing Resolution</h4>
                      <Badge variant="destructive">{eventsNeedingAction.length}</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                      Events that have ended and need admin result setting
                    </p>
                    <Link href="/admin/events">
                      <Button size="sm" className="bg-red-600 hover:bg-red-700">
                        Resolve Events <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}

                {challengesNeedingAction.length > 0 && (
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">Challenges Needing Resolution</h4>
                      <Badge variant="destructive">{challengesNeedingAction.length}</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">
                      Challenges that are overdue and need admin intervention
                    </p>
                    <Link href="/admin/challenges">
                      <Button size="sm" className="bg-red-600 hover:bg-red-700">
                        Resolve Challenges <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Platform Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events Section */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-blue-400" />
                  Event Management
                </div>
                <Link href="/admin/events">
                  <Button size="sm" variant="outline" className="border-slate-600">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Active</p>
                    <p className="text-lg font-bold text-blue-400">{activeEvents.length}</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Completed</p>
                    <p className="text-lg font-bold text-green-400">{completedEvents.length}</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Pool Value</p>
                    <p className="text-lg font-bold text-white">₦{totalEventPool.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Challenges Section */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center">
                  <Target className="w-5 h-5 mr-2 text-purple-400" />
                  Challenge Management
                </div>
                <Link href="/admin/challenges">
                  <Button size="sm" variant="outline" className="border-slate-600">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Active</p>
                    <p className="text-lg font-bold text-purple-400">{activeChallenges.length}</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Completed</p>
                    <p className="text-lg font-bold text-green-400">{completedChallenges.length}</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-sm text-slate-400">Staked</p>
                    <p className="text-lg font-bold text-white">₦{totalChallengeStaked.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Challenge Imbalance Monitoring */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <Scale className="w-5 h-5 mr-2 text-orange-400" />
                Challenge Imbalance Monitoring
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Bonus System
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Imbalanced Challenges */}
              {challenges.filter((c: Challenge) => c.status === 'active' && calculateChallengeImbalance(c).imbalancePercent >= 20).length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-300">Challenges Needing Bonus Intervention</h4>
                  {challenges
                    .filter((c: Challenge) => c.status === 'active' && calculateChallengeImbalance(c).imbalancePercent >= 20)
                    .slice(0, 5)
                    .map((challenge: Challenge) => {
                      const { imbalancePercent, weakerSide } = calculateChallengeImbalance(challenge);
                      const hasActiveBonus = challenge.bonusSide && challenge.bonusEndsAt && new Date(challenge.bonusEndsAt) > new Date();
                      
                      return (
                        <div key={challenge.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-white text-sm">{challenge.title}</h5>
                            <div className="flex items-center gap-2">
                              {weakerSide && (
                                <Badge variant="outline" className={`text-xs ${
                                  weakerSide === 'YES' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                  {weakerSide} Side Weaker
                                </Badge>
                              )}
                              {hasActiveBonus && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Bonus Active
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-slate-400">YES Stake</p>
                              <p className="text-blue-400 font-medium">₦{(challenge.yesStakeTotal || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">NO Stake</p>
                              <p className="text-red-400 font-medium">₦{(challenge.noStakeTotal || 0).toLocaleString()}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-400">Imbalance</p>
                              <p className={`font-medium ${imbalancePercent >= 40 ? 'text-red-400' : 'text-orange-400'}`}>
                                {imbalancePercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          
                          {hasActiveBonus && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                  {challenge.bonusSide} side bonus: {challenge.bonusMultiplier}x
                                </span>
                                <span className="text-slate-400">
                                  Ends: {new Date(challenge.bonusEndsAt!).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {!hasActiveBonus && weakerSide && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <Button 
                                size="sm" 
                                className="w-full bg-orange-600 hover:bg-orange-700"
                                onClick={() => openBonusModal(challenge, weakerSide)}
                              >
                                <Zap className="w-4 h-4 mr-1" />
                                Activate {weakerSide} Bonus
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Scale className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">All challenges are well balanced</p>
                  <p className="text-xs text-slate-500 mt-1">No bonus interventions needed at this time</p>
                </div>
              )}
              
              {/* Bonus System Stats */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700">
                <div className="bg-slate-800 p-3 rounded-lg text-center">
                  <p className="text-sm text-slate-400">Active Bonuses</p>
                  <p className="text-lg font-bold text-green-400">
                    {challenges.filter((c: Challenge) => c.bonusSide && c.bonusEndsAt && new Date(c.bonusEndsAt) > new Date()).length}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg text-center">
                  <p className="text-sm text-slate-400">Imbalanced (≥20%)</p>
                  <p className="text-lg font-bold text-orange-400">
                    {challenges.filter((c: Challenge) => c.status === 'active' && calculateChallengeImbalance(c).imbalancePercent >= 20).length}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg text-center">
                  <p className="text-sm text-slate-400">Severely Imbalanced (≥40%)</p>
                  <p className="text-lg font-bold text-red-400">
                    {challenges.filter((c: Challenge) => c.status === 'active' && calculateChallengeImbalance(c).imbalancePercent >= 40).length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Management and Search */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Search & Management */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-400" />
                  User Management
                </div>
                <Link href="/admin/users">
                  <Button size="sm" variant="outline" className="border-slate-600">
                    Manage Users <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-slate-400 text-sm">Online Users</p>
                    <p className="text-xl font-bold text-green-400">{allUsers.filter((u: any) => u.status === 'Online').length}</p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg text-center">
                    <p className="text-slate-400 text-sm">New This Week</p>
                    <p className="text-xl font-bold text-blue-400">{recentUsers.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Statistics */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity className="w-5 h-5 mr-2 text-purple-400" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-400 text-sm">Total Transactions</p>
                  <p className="text-2xl font-bold text-white">{(adminStats as any).totalTransactions || 0}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-400 text-sm">Total Deposits</p>
                  <p className="text-2xl font-bold text-green-400">₦{((adminStats as any).totalDeposits || 0).toLocaleString()}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-400 text-sm">Total Withdrawals</p>
                  <p className="text-2xl font-bold text-orange-400">₦{((adminStats as any).totalWithdrawals || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bonus Activation Modal */}
      <Dialog open={bonusModalOpen} onOpenChange={setBonusModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <Zap className="w-5 h-5 mr-2 text-orange-400" />
              Activate Bonus for Challenge
            </DialogTitle>
          </DialogHeader>
          
          {selectedChallenge && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-medium text-white mb-2">{selectedChallenge.title}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">YES Stake</p>
                    <p className="text-blue-400">₦{(selectedChallenge.yesStakeTotal || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">NO Stake</p>
                    <p className="text-red-400">₦{(selectedChallenge.noStakeTotal || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="bonusSide" className="text-white">Bonus Side</Label>
                  <Select value={bonusSide} onValueChange={setBonusSide}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Select bonus side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">YES Side</SelectItem>
                      <SelectItem value="NO">NO Side</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bonusMultiplier" className="text-white">Bonus Multiplier</Label>
                  <Select value={bonusMultiplier} onValueChange={setBonusMultiplier}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Select multiplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.2">1.2x (Conservative)</SelectItem>
                      <SelectItem value="1.5">1.5x (Moderate)</SelectItem>
                      <SelectItem value="2.0">2.0x (Aggressive)</SelectItem>
                      <SelectItem value="2.5">2.5x (High Impact)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bonusDuration" className="text-white">Duration (Hours)</Label>
                  <Select value={bonusDuration} onValueChange={setBonusDuration}>
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 Hours</SelectItem>
                      <SelectItem value="24">24 Hours</SelectItem>
                      <SelectItem value="48">48 Hours</SelectItem>
                      <SelectItem value="72">72 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg">
                <p className="text-blue-400 text-sm">
                  <strong>Preview:</strong> {bonusSide} side will receive {bonusMultiplier}x payout multiplier for the next {bonusDuration} hours.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setBonusModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleActivateBonus}
                  disabled={activateBonusMutation.isPending}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  {activateBonusMutation.isPending ? "Activating..." : "Activate Bonus"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}