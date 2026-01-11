import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getGlobalChannel } from "@/lib/pusher";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChallengeCard } from "@/components/ChallengeCard";
import { ChallengeChat } from "@/components/ChallengeChat";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { ChallengePreviewCard } from "@/components/ChallengePreviewCard";
import { BantMap } from "@/components/BantMap";
import { Button } from "@/components/ui/button";
import CategoryBar from "@/components/CategoryBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { UserAvatar } from "@/components/UserAvatar";
import {
  MessageCircle,
  Clock,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Shield,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function ChallengeCardSkeleton() {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[160px] bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse">
      <CardContent className="p-4 flex flex-col h-full space-y-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-1/2 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/50" />
          <Skeleton className="h-3 w-5/6 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
        <div className="pt-2 flex justify-between items-center">
          <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-12 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        </div>
      </CardContent>
    </Card>
  );
}

const createChallengeSchema = z.object({
  challenged: z.string().min(1, "Please select who to challenge"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Stake amount is required"),
  dueDate: z.string().optional(),
});

export default function Challenges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [challengeStatusTab, setChallengeStatusTab] = useState<'all' | 'p2p' | 'open' | 'active' | 'pending' | 'completed' | 'ended'>('all');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [preSelectedUser, setPreSelectedUser] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<string>('featured');
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Listen for header search events dispatched from Navigation
  useEffect(() => {
    const onSearch = (e: any) => {
      const val = e?.detail ?? "";
      setSearchTerm(val);
    };
    const onOpen = () => setIsSearchOpen(true);
    const onOpenCreateDialog = () => setIsCreateDialogOpen(true);

    window.addEventListener("challenges-search", onSearch as EventListener);
    window.addEventListener("open-challenges-search", onOpen as EventListener);
    window.addEventListener("open-create-dialog", onOpenCreateDialog as EventListener);

    return () => {
      window.removeEventListener("challenges-search", onSearch as EventListener);
      window.removeEventListener("open-challenges-search", onOpen as EventListener);
      window.removeEventListener("open-create-dialog", onOpenCreateDialog as EventListener);
    };
  }, []);

  const form = useForm<z.infer<typeof createChallengeSchema>>({
    resolver: zodResolver(createChallengeSchema),
    defaultValues: {
      challenged: "",
      title: "",
      description: "",
      category: "",
      amount: "",
      dueDate: "",
    },
  });

  const { data: challenges = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/challenges/public", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.json().then(e => e.message).catch(() => "Unknown error")}`);
        }
        const data = await response.json();
        return data.map((challenge: any) => ({
          ...challenge,
          commentCount: challenge.commentCount ?? 0,
          participantCount: challenge.participantCount ?? 0,
        }));
      } catch (error: any) {
        throw error;
      }
    },
    retry: false,
  });

  const { data: friends = [] as any[] } = useQuery({
    queryKey: ["/api/friends"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  const {
    data: allUsers = [] as any[],
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["/api/users"],
    retry: false,
    enabled: !!user, // Only fetch when user is authenticated
  });

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    retry: false,
  });

  // Real-time listeners for challenge updates via Pusher
  useEffect(() => {
    const globalChannel = getGlobalChannel();
    
    // Listen for new challenge messages
    const handleNewMessage = (data: any) => {
      if (data.type === 'challenge_message' || data.challengeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    // Listen for when users join challenges  
    const handleChallengeJoined = (data: any) => {
      if (data.type === 'challenge_joined' || data.challengeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      }
    };

    globalChannel.bind('new-message', handleNewMessage);
    globalChannel.bind('challenge-joined', handleChallengeJoined);

    return () => {
      globalChannel.unbind('new-message', handleNewMessage);
      globalChannel.unbind('challenge-joined', handleChallengeJoined);
      globalChannel.unsubscribe();
    };
  }, [queryClient]);

  const createChallengeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createChallengeSchema>) => {
      const challengeData = {
        ...data,
        amount: data.amount, // Keep as string for backend validation
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : undefined,
      };
      await apiRequest("POST", "/api/challenges", challengeData);
    },
    onSuccess: () => {
      toast({
        title: "Challenge Created",
        description: "Your challenge has been sent!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      setIsCreateDialogOpen(false);
      setPreSelectedUser(null);
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const categories = [
    { id: "create", label: "Create", icon: "/assets/create.png", gradient: "from-green-400 to-emerald-500", isCreate: true, value: "create" },
    { id: "all", label: "All", icon: "/assets/versus.svg", gradient: "from-blue-400 to-purple-500", value: "all" },
    { id: "sports", label: "Sports", icon: "/assets/sportscon.svg", gradient: "from-green-400 to-blue-500", value: "sports" },
    { id: "gaming", label: "Gaming", icon: "/assets/gamingsvg.svg", gradient: "from-gray-400 to-gray-600", value: "gaming" },
    { id: "crypto", label: "Crypto", icon: "/assets/cryptosvg.svg", gradient: "from-yellow-400 to-orange-500", value: "crypto" },
    { id: "trading", label: "Trading", icon: "/assets/cryptosvg.svg", gradient: "from-yellow-400 to-orange-500", value: "trading" },
    { id: "music", label: "Music", icon: "/assets/musicsvg.svg", gradient: "from-blue-400 to-purple-500", value: "music" },
    { id: "entertainment", label: "Entertainment", icon: "/assets/popcorn.svg", gradient: "from-pink-400 to-red-500", value: "entertainment" },
    { id: "politics", label: "Politics", icon: "/assets/poltiii.svg", gradient: "from-green-400 to-teal-500", value: "politics" },
  ];

  const filteredChallenges = challenges.filter((challenge: any) => {
    const searchLower = searchTerm ? searchTerm.toLowerCase() : "";
    const matchesSearch =
      !searchTerm ||
      (challenge.title || "").toLowerCase().includes(searchLower) ||
      (challenge.description || "").toLowerCase().includes(searchLower) ||
      (challenge.category || "").toLowerCase().includes(searchLower) ||
      (challenge.challengerUser?.username || "")
        .toLowerCase()
        .includes(searchLower) ||
      (challenge.challengedUser?.username || "")
        .toLowerCase()
        .includes(searchLower);

    const matchesCategory =
      selectedCategory === "all" || challenge.category === selectedCategory;

    // Determine admin-created flag explicitly
    const isAdminCreated = challenge.adminCreated === true;

    // Filter by challenge status or P2P tab
    const matchesStatus =
      challengeStatusTab === 'all' ? true :
      challengeStatusTab === 'p2p' ? !isAdminCreated :
      challengeStatusTab === 'open' ? challenge.status === 'open' :
      challengeStatusTab === 'active' ? challenge.status === 'active' :
      challengeStatusTab === 'pending' ? challenge.status === 'pending' :
      challengeStatusTab === 'completed' ? challenge.status === 'completed' :
      challengeStatusTab === 'ended' ? (challenge.status === 'completed' || challenge.status === 'cancelled' || challenge.status === 'disputed') :
      true;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredUsers = (allUsers as any[]).filter((u: any) => {
    if (!searchTerm || u.id === user?.id) return false;
    if (u.isAdmin) return false; // Hide admin and superadmin users
    const searchLower = searchTerm.toLowerCase();
    const firstName = (u.firstName || "").toLowerCase();
    const lastName = (u.lastName || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      username.includes(searchLower) ||
      fullName.includes(searchLower)
    );
  });

  const pendingChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending" && !c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id),
  );
  const activeChallenges = filteredChallenges.filter(
    (c: any) => c.status === "active" && !c.adminCreated,
  );
  const awaitingResolutionChallenges = filteredChallenges.filter(
    (c: any) => c.status === "pending_admin" && c.adminCreated && (c.challengerId === user?.id || c.challengedId === user?.id || c.creatorId === user?.id),
  );
  const completedChallenges = filteredChallenges.filter(
    (c: any) => c.status === "completed" && !c.adminCreated,
  );
  const featuredChallenges = filteredChallenges.filter(
    (c: any) => c.adminCreated && c.status !== "pending_admin",
  );

  // Validate selected tab - reset to featured if current tab is hidden
  useEffect(() => {
    const isTabVisible = 
      selectedTab === 'featured' || 
      selectedTab === 'active' ||
      selectedTab === 'completed' ||
      (user && selectedTab === 'pending' && pendingChallenges.length > 0) ||
      (user && selectedTab === 'awaiting_resolution' && awaitingResolutionChallenges.length > 0);
    
    if (!isTabVisible) {
      setSelectedTab('featured');
    }
  }, [selectedTab, user, pendingChallenges.length, awaitingResolutionChallenges.length]);

  const onSubmit = (data: z.infer<typeof createChallengeSchema>) => {
    const amount = parseFloat(data.amount);
    const currentBalance =
      balance && typeof balance === "object" ? (balance as any).balance : balance;

    if (amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough funds to create this challenge.",
        variant: "destructive",
      });
      return;
    }

    createChallengeMutation.mutate(data);
  };

  const handleChallengeClick = (challenge: any) => {
    // Navigate to the challenge activity page instead of opening the modal.
    // This allows users to view the activity page even if they're not a participant.
    window.location.href = `/challenges/${challenge.id}/activity`;
  };

  const handleJoin = (challenge: any) => {
    setSelectedChallenge(challenge);
    setShowJoinModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "disputed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return Clock;
      case "active":
        return Zap;
      case "completed":
        return Trophy;
      case "disputed":
        return Shield;
      default:
        return Clock;
    }
  };

  // Handle authentication errors
  useEffect(() => {
    if (usersError && isUnauthorizedError(usersError as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
    }
  }, [usersError, toast]);

  if (!user) {
    // Allow unauthenticated users to view challenges but show login prompts for actions
  }

  const sortedChallenges = [...filteredChallenges].sort((a: any, b: any) => {
    // Priority 0: Pinned challenges first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Priority 1: Pending (Action Required)
    const aIsPending = a.status === 'pending' && !a.adminCreated && (a.challengerId === user?.id || a.challengedId === user?.id);
    const bIsPending = b.status === 'pending' && !b.adminCreated && (b.challengerId === user?.id || b.challengedId === user?.id);
    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;

    // Priority 2: Active/Live
    const aIsActive = a.status === 'active';
    const bIsActive = b.status === 'active';
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // Priority 3: Featured/Open (Admin created matches)
    const aIsOpen = a.status === 'open' && a.adminCreated;
    const bIsOpen = b.status === 'open' && b.adminCreated;
    if (aIsOpen && !bIsOpen) return -1;
    if (!aIsOpen && bIsOpen) return 1;

    // Priority 4: Awaiting Resolution
    const aIsAwaiting = a.status === 'pending_admin';
    const bIsAwaiting = b.status === 'pending_admin';
    if (aIsAwaiting && !bIsAwaiting) return -1;
    if (!aIsAwaiting && bIsAwaiting) return 1;

    // Default: Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8 py-2 md:py-4">
        <CategoryBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={(id) => {
            if (id === 'create') {
              setIsCreateDialogOpen(true);
              return;
            }
            setSelectedCategory(id);
          }}
        />

        {/* Challenge Status Tabs */}
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1 md:flex md:justify-center">
          <Tabs 
            defaultValue="all" 
            value={challengeStatusTab} 
            onValueChange={(val) => setChallengeStatusTab(val as any)} 
            className="w-full md:w-auto"
          >
            <TabsList className="inline-flex w-fit h-8 border-0 shadow-none bg-transparent gap-1 items-center">
              <TabsTrigger 
                value="all" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="p2p" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                P2P
              </TabsTrigger>
              <TabsTrigger 
                value="open" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Open
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Active
              </TabsTrigger>
              <TabsTrigger 
                value="pending" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Pending
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Completed
              </TabsTrigger>
              <TabsTrigger 
                value="ended" 
                className="text-xs px-3 py-1.5 rounded-full data-[state=active]:bg-[#ccff00] data-[state=active]:text-black whitespace-nowrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all h-auto"
              >
                Ended
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {[...Array(6)].map((_, i) => (
                <ChallengeCardSkeleton key={i} />
              ))}
            </div>
          ) : sortedChallenges.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {sortedChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onChatClick={handleChallengeClick}
                  onJoin={handleJoin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No challenges found</h3>
              <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or category filters</p>
            </div>
          )}
        </div>

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setPreSelectedUser(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-sm max-w-[90vw] max-h-[75vh] overflow-y-auto p-4">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg flex items-center space-x-2">
                {preSelectedUser ? (
                  <>
                    <UserAvatar
                      userId={preSelectedUser.id}
                      username={preSelectedUser.username}
                      size={24}
                      className="h-6 w-6"
                    />
                    <span>
                      Challenge{" "}
                      {preSelectedUser.firstName || preSelectedUser.username}
                    </span>
                  </>
                ) : (
                  "Create New Challenge"
                )}
              </DialogTitle>
            </DialogHeader>
            {/* Challenge Preview Card */}
            {(form.watch("challenged") || preSelectedUser) && form.watch("title") && form.watch("amount") && (
              <div className="mb-3">
                <div className="hidden sm:block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Preview</div>
                <ChallengePreviewCard
                  challenger={{
                    id: user?.id || '',
                    firstName: (user as any)?.firstName,
                    username: (user as any)?.username,
                    profileImageUrl: (user as any)?.profileImageUrl
                  }}
                  challenged={preSelectedUser || {
                    id: form.watch("challenged"),
                    firstName: "Selected User",
                    username: "user"
                  }}
                  title={form.watch("title")}
                  description={form.watch("description")}
                  category={form.watch("category")}
                  amount={form.watch("amount")}
                  dueDate={form.watch("dueDate")}
                />
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-2"
              >
                {!preSelectedUser && (
                  <FormField
                    control={form.control}
                    name="challenged"
                    render={({ field }) => {
                      // Deduplicate friend list by user id to avoid repeating entries
                      const uniqueMap = new Map<string, any>();
                      (friends as any[] || []).forEach((friend: any) => {
                        const friendUser =
                          friend.requesterId === user?.id
                            ? friend.addressee
                            : friend.requester;
                        if (friendUser && friendUser.id && !uniqueMap.has(friendUser.id)) {
                          uniqueMap.set(friendUser.id, friendUser);
                        }
                      });
                      const uniqueFriendUsers = Array.from(uniqueMap.values());

                      return (
                        <FormItem className="space-y-1">
                          <FormLabel className="sr-only">
                            Challenge Friend
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 rounded-lg text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/50 transition-colors">
                                <SelectValue placeholder="👥 Select a friend to challenge" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-[80] border-0 shadow-md bg-white dark:bg-slate-800 rounded-lg">
                              {uniqueFriendUsers.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">
                                  <p>No friends yet</p>
                                  <p className="text-xs mt-1">Go to Friends tab to add friends</p>
                                </div>
                              ) : (
                                uniqueFriendUsers.map((friendUser: any) => (
                                  <SelectItem
                                    key={friendUser.id}
                                    value={friendUser.id}
                                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 py-2 border-0 outline-none"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                        {(friendUser.firstName?.[0] || friendUser.username?.[0] || "U").toUpperCase()}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-medium text-sm">
                                          {friendUser.firstName || friendUser.username}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          @{friendUser.username || 'user'}
                                        </span>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}

                {preSelectedUser && (
                  <div className="flex items-center space-x-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {(
                        preSelectedUser.firstName ||
                        preSelectedUser.username ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-xs">
                        {preSelectedUser.firstName ||
                          preSelectedUser.username}
                      </p>
                      <p className="text-xs text-slate-500">
                        Level {preSelectedUser.level || 1} •{" "}
                        {preSelectedUser.points || 0} pts
                      </p>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="sr-only">
                        Challenge Title
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="What's the challenge?"
                          className="h-8 text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="sr-only">
                        Description (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the challenge details..."
                          className="min-h-[50px] text-sm resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="sr-only">
                          Category
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-8 text-sm bg-transparent border-none focus:ring-0">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-none ring-0 shadow-none">
                            {categories.map((category) => (
                              <SelectItem
                                key={category.value}
                                value={category.value}
                              >
                                <div className="flex items-center space-x-2">
                                  <i className={category.icon}></i>
                                  <span>{category.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="sr-only">
                            Stake (₦)
                          </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="500"
                            className="h-8 text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="space-y-1 col-span-2 sm:col-span-1">
                        <FormLabel className="sr-only">
                          End Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            className="h-8 text-sm"
                            {...field}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 h-8 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createChallengeMutation.isPending}
                    className="flex-1 h-8 text-sm text-black hover:opacity-90"
                    style={{ backgroundColor: '#ccff00' }}
                  >
                    {createChallengeMutation.isPending
                      ? "Creating..."
                      : "Challenge"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Search results and other content below the feed */}
        {searchTerm && (
          <div className="mt-8 space-y-6">
             {/* Search content... */}
          </div>
        )}
      </div>

      {/* Challenge Chat Dialog */}
      {showChat && selectedChallenge && (
        <Dialog open={showChat} onOpenChange={setShowChat}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] p-0">
            <ChallengeChat
              challenge={selectedChallenge}
              onClose={() => setShowChat(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Join Challenge Modal (for admin-created betting challenges) */}
      {showJoinModal && selectedChallenge && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={selectedChallenge}
          userBalance={balance && typeof balance === "object" ? (balance as any).balance : (typeof balance === 'number' ? balance : 0)}
        />
      )}

      <MobileNavigation />
    </div>
  );
}
