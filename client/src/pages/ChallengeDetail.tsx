import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ChallengeIntentCard } from "@/components/ChallengeIntentCard";
import { SocialMediaShare } from "@/components/SocialMediaShare";
import { ChallengeChat } from "@/components/ChallengeChat";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { JoinChallengeModal } from "@/components/JoinChallengeModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayfulLoading } from "@/components/ui/playful-loading";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  MessageCircle, 
  Share2, 
  Users, 
  Trophy,
  Clock,
  Eye,
  LogIn,
  MessageSquare,
  Activity as ActivityIcon,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function ChallengeActivity({ challengeId }: { challengeId: string }) {
  const { data: activity = [] } = useQuery<any[]>({
    queryKey: [`/api/challenges/${challengeId}/activity`],
  });

  if (activity.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No activity yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activity.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={item.user?.profileImageUrl} />
            <AvatarFallback>{item.user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-gray-900 dark:text-gray-100 leading-tight">
              <span className="font-semibold text-blue-600 dark:text-blue-400">{item.user?.username}</span> {item.action}
            </p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChallengeMatches({ challengeId }: { challengeId: string }) {
  const { data: matches = [] } = useQuery<any[]>({
    queryKey: [`/api/challenges/${challengeId}/matches`],
  });

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No matches recorded for this challenge yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map((match, i) => (
        <div key={i} className="p-4 rounded-xl border bg-white dark:bg-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8 flex-1">
              {/* Participant 1 */}
              <div className="flex flex-col items-center gap-1 text-center min-w-[80px]">
                <Avatar className="w-10 h-10 ring-2 ring-primary/10">
                  <AvatarImage src={match.user?.profileImageUrl} />
                  <AvatarFallback>{match.user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">@{match.user?.username}</span>
                <span className="text-xs font-bold text-primary">{match.side}</span>
              </div>

              <div className="text-gray-400 font-bold italic">vs</div>

              {/* Participant 2 */}
              <div className="flex flex-col items-center gap-1 text-center min-w-[80px]">
                {match.matchedWithUser ? (
                  <>
                    <Avatar className="w-10 h-10 ring-2 ring-primary/10">
                      <AvatarImage src={match.matchedWithUser?.profile_image_url} />
                      <AvatarFallback>{match.matchedWithUser?.username?.[0]?.toUpperCase() || 'O'}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">@{match.matchedWithUser?.username}</span>
                    <span className="text-xs font-bold text-destructive">{match.side === 'YES' ? 'NO' : 'YES'}</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <Users className="w-5 h-5 text-gray-400" />
                    </div>
                    <span className="text-[10px] text-gray-400 italic">Waiting...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/50">Match #{match.id}</Badge>
              <div className="text-xs font-bold text-green-600">Stake {match.stakeAmount}</div>
              {match.status === 'matched' && <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">Active</Badge>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChallengeComments({ challengeId }: { challengeId: string }) {
  const { data: messages = [] } = useQuery<any[]>({
    queryKey: [`/api/challenges/${challengeId}/messages`],
  });

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No comments yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            {msg.user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{msg.user?.username || msg.user?.firstName || `user_${msg.userId?.slice(-8) || 'unknown'}`}</span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{msg.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChallengeDetail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [showChat, setShowChat] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['/api/challenges', id],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${id}`);
      if (!response.ok) {
        throw new Error('Challenge not found');
      }
      return response.json();
    },
    enabled: !!id,
    retry: false,
  });

  const { data: balance = 0 } = useQuery<any>({
    queryKey: ["/api/wallet/balance"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <PlayfulLoading type="general" title="Loading Challenge" />
        </div>
        <MobileNavigation />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto border-none shadow-none text-center">
            <CardContent className="p-12">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-slate-400" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Challenge Not Found
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                The challenge you're looking for doesn't exist or has been removed from the platform.
              </p>
              <Button onClick={() => window.history.back()} variant="outline" className="rounded-full px-8">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  const isParticipant = user && challenge && (user.id === challenge.challenger || user.id === challenge.challenged);
  const isAdminOpenChallenge = challenge?.adminCreated && challenge?.status === 'open' && !challenge?.challenger && !challenge?.challenged;
  const canJoinQueue = isAdminOpenChallenge && user && !isParticipant;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-24">
      <DynamicMetaTags challenge={challenge} pageType="challenge" />
      
      {/* Immersive Hero Header */}
      <div className="relative h-64 md:h-80 bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/90 z-10" />
        <div className="absolute top-6 left-6 z-20">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="text-white hover:bg-white/10 backdrop-blur-sm rounded-full"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
        </div>
        <div className="absolute bottom-8 left-6 right-6 z-20">
          <div className="flex items-center gap-3 mb-3">
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-none px-3 py-1">
              {challenge.category.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-white border-white/20 backdrop-blur-sm px-3 py-1">
              {challenge.status.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            {challenge.title}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-12 relative z-30">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Action Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-3xl font-black text-green-600 dark:text-green-400">
                  ₦{parseInt(challenge.amount).toLocaleString()}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stake Amount</div>
              </div>
              
              <div className="flex items-center gap-3">
                {canJoinQueue && (
                  <Button
                    onClick={() => setShowJoinModal(true)}
                    className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-transform"
                  >
                    Join Challenge
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-slate-200 dark:border-slate-800">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Description & Rules */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-8">
              <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">About Challenge</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                {challenge.description || "No detailed description provided for this challenge. Join now to participate in this event and compete for the prize pool."}
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-bold mb-2">Escrow Protection</h4>
                  <p className="text-sm text-slate-500">Your funds are safe and held in escrow until the challenge is verified.</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4">
                    <Trophy className="w-5 h-5 text-green-600" />
                  </div>
                  <h4 className="font-bold mb-2">Verified Payouts</h4>
                  <p className="text-sm text-slate-500">Winners receive automated payouts immediately after result verification.</p>
                </div>
              </div>
            </div>

            {/* Interactive Tabs Section */}
            <Tabs defaultValue="activity" className="w-full">
              <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 relative z-10">
                <TabsList className="flex items-center justify-start gap-8 bg-transparent p-0">
                  {["activity", "matches", "comments"].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="p-0 bg-transparent shadow-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none h-10 font-bold text-slate-500 uppercase tracking-widest text-xs transition-all"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="mt-6">
                <TabsContent value="activity">
                  <ChallengeActivity challengeId={id} />
                </TabsContent>
                <TabsContent value="matches">
                  <ChallengeMatches challengeId={id} />
                </TabsContent>
                <TabsContent value="comments">
                  <ChallengeComments challengeId={id} />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            {/* Participants Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Users className="w-32 h-32" />
              </div>
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <Users className="w-6 h-6 text-blue-400" />
                Participants
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center ring-4 ring-blue-600/20 group-hover:scale-105 transition-transform">
                      <span className="text-xl font-black">
                        {(challenge.challengerUser?.username || 'C').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-black text-lg">
                        {challenge.challengerUser?.username || 'Challenger'}
                      </div>
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">Host</div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                </div>

                <div className="flex items-center justify-center py-2">
                  <div className="w-full h-px bg-white/10 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-4 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                      VS
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center ring-4 ring-purple-600/20 group-hover:scale-105 transition-transform">
                      <span className="text-xl font-black">
                        {(challenge.challengedUser?.username || 'O').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-black text-lg">
                        {challenge.challengedUser?.username || 'Opponent'}
                      </div>
                      <div className="text-xs font-bold text-purple-400 uppercase tracking-widest">Opponent</div>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating Action Bar for Participants */}
      {isParticipant && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-lg">
          <Button
            onClick={() => setShowChat(!showChat)}
            className="w-full h-16 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <MessageCircle className="w-6 h-6" />
            {showChat ? 'Close Discussion' : 'Join Discussion'}
          </Button>
        </div>
      )}

      {/* Join Challenge Modal */}
      {canJoinQueue && (
        <JoinChallengeModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          challenge={{
            id: challenge.id,
            title: challenge.title,
            category: challenge.category,
            amount: challenge.amount,
            description: challenge.description,
          }}
          userBalance={balance && typeof balance === "object" ? (balance as any).balance : (typeof balance === 'number' ? balance : 0)}
        />
      )}

      {/* Floating Chat Overlay */}
      {showChat && isParticipant && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl h-[80vh]">
            <ChallengeChat challenge={challenge} onClose={() => setShowChat(false)} />
          </div>
        </div>
      )}

      <MobileNavigation />
    </div>
  );
}