import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import ProfileCard from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getChallengeChannel } from "@/lib/pusher";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Users, Activity, Send, Trophy, DollarSign, UserPlus, Zap, Heart, MessageSquare, Share2, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/UserAvatar";

interface ExtendedMessage {
  id: string;
  challengeId: number;
  userId: string;
  message: string;
  createdAt: string;
  type?: 'system' | 'user';
  user: {
    id: string;
    username?: string;
    firstName?: string;
  };
}

interface ActivityEvent {
  id: string;
  user?: {
    id: string;
    username?: string;
    firstName?: string;
    avatarUrl?: string;
  };
  action: string;
  createdAt: string;
}

interface Challenge {
  id: number;
  title: string;
  description?: string;
  category: string;
  amount: string;
  dueDate: string;
  coverImageUrl?: string;
  status: string;
  adminCreated?: boolean;
  challengerUser?: {
    id: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string;
  };
  challengedUser?: {
    id: string;
    username?: string;
    firstName?: string;
    profileImageUrl?: string;
  };
}

export default function ChallengeChatPage() {
  const params = useParams();
  const challengeId = params.id ? parseInt(params.id) : null;
  const { user, isAuthenticated } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'matches' | 'activity'>('comments');
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Determine if current user is a participant in the challenge
  const { data: challenge } = useQuery<Challenge>({
    queryKey: [`/api/challenges/${challengeId}`],
    enabled: !!challengeId,
    retry: false,
  });
  
  // Check if this is a P2P challenge (has both challenger and challenged users)
  const isP2PChallenge = !!(challenge?.challengerUser && challenge?.challengedUser);
  
  // Determine if user is a participant
  const isParticipant = user && challenge && (user.id === challenge.challengerUser?.id || user.id === challenge.challengedUser?.id);
  
  // For P2P challenges only: hide comments tab from non-participants
  const shouldHideCommentsTab = isP2PChallenge && !isParticipant;
  
  // Set default tab - non-participants in P2P challenges default to matches
  useEffect(() => {
    if (shouldHideCommentsTab && activeTab === 'comments') {
      setActiveTab('matches');
    }
  }, [shouldHideCommentsTab, activeTab]);

  const { data: messages = [], refetch: refetchMessages } = useQuery<ExtendedMessage[]>({
    queryKey: [`/api/challenges/${challengeId}/messages`],
    enabled: !!challengeId,
    retry: false,
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery<any[]>({
    queryKey: [`/api/challenges/${challengeId}/matches`],
    queryFn: async () => {
      if (!challengeId) return [];
      const res = await fetch(`/api/challenges/${challengeId}/matches`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!challengeId,
    retry: false,
  });

  const { data: activityEvents = [] } = useQuery<ActivityEvent[]>({
    queryKey: [`/api/challenges/${challengeId}/activity`],
    enabled: !!challengeId,
    retry: false,
  });

  useEffect(() => {
    if (!challengeId) return;
    
    const channel = getChallengeChannel(challengeId);
    
    // Listen for new messages in real-time
    channel.bind('new-message', () => {
      refetchMessages();
    });

    return () => {
      channel.unbind('new-message');
      channel.unsubscribe();
    };
  }, [challengeId, refetchMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string }) => {
      return await apiRequest("POST", `/api/challenges/${challengeId}/messages`, messageData);
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate({ message: newMessage });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLikeMessage = (messageId: string) => {
    setLikedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleReplyMessage = (messageId: string) => {
    setReplyingTo(replyingTo === messageId ? null : messageId);
  };

  const handleShareMessage = (messageId: string, messageText: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      const shareText = `"${messageText}"\n- ${message.user?.username || message.user?.firstName || `user_${message.userId?.slice(-8) || 'unknown'}`}`;
      if (navigator.share) {
        navigator.share({
          title: 'Shared from Challenge',
          text: shareText
        }).catch(() => {});
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
          alert('Message copied to clipboard!');
        }).catch(() => {
          alert('Copy to clipboard failed');
        });
      }
    }
  };

  if (!challengeId) return <div className="flex items-center justify-center h-screen">Challenge Not Found</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        {/* Challenge Banner */}
        {challenge && (
          <div className="relative h-24 sm:h-28 bg-gradient-to-b from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 overflow-hidden rounded-lg mx-2 mt-2">
            {challenge.coverImageUrl ? (
              <img
                src={challenge.coverImageUrl}
                alt={challenge.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <Trophy className="w-8 h-8 text-white mx-auto mb-2 opacity-80" />
                  <p className="text-white text-xs opacity-70">Challenge</p>
                </div>
              </div>
            )}
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/20 dark:bg-black/40 rounded-lg"></div>
            
            {/* Challenge Info */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 sm:p-3">
              <div className="text-white drop-shadow-lg">
                <h1 className="text-sm sm:text-base font-bold truncate">{challenge.title}</h1>
              </div>
              <div className="text-white drop-shadow-lg text-[10px] sm:text-xs space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-white/20 px-2 py-0.5 rounded-full capitalize">{challenge.category}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">₦{parseInt(challenge.amount).toLocaleString()}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full capitalize">{challenge.status}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full">
                    {formatDistanceToNow(new Date(challenge.dueDate), { addSuffix: true })}
                  </span>
                </div>
                {challenge.description && (
                  <p className="text-white/80 line-clamp-1">{challenge.description}</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <Tabs defaultValue={shouldHideCommentsTab ? "matches" : "comments"} value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
            <TabsList className={`grid ${shouldHideCommentsTab ? 'grid-cols-2' : 'grid-cols-3'} w-full bg-transparent p-0 rounded-none`}>
              {!shouldHideCommentsTab && (
                <TabsTrigger 
                  value="comments" 
                  className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Comments</span>
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="matches" 
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Matches</span>
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-blue-500 py-2 text-slate-600 dark:text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50 dark:bg-slate-900 pb-32">
            {!shouldHideCommentsTab && (
            <TabsContent value="comments" className="m-0 p-4 h-full flex flex-col data-[state=inactive]:hidden">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p>No messages yet. Be the first to talk!</p>
                  </div>
                ) : (
                  messages.map((m: ExtendedMessage) => {
                    const isMe = m.userId === user?.id;
                    return (
                      <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && (
                          <div className="flex-shrink-0">
                            <UserAvatar userId={m.userId} username={m.user?.username} size={32} />
                          </div>
                        )}
                        <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 ml-1">
                              {m.user?.username || m.user?.firstName || `user_${m.userId?.slice(-8) || 'unknown'}`}
                            </span>
                          )}
                          <div className={`p-3 rounded-2xl shadow-sm group hover:shadow-md transition-shadow ${
                            isMe 
                              ? 'bg-blue-500 text-white rounded-tr-none' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'
                          }`}>
                            <p className="text-sm break-words">{m.message}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                            </span>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => handleReplyMessage(m.id)}
                                className={`p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors ${
                                  replyingTo === m.id ? 'bg-blue-200 dark:bg-blue-900' : ''
                                }`}
                                title="Reply"
                              >
                                <Reply className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                              </button>
                              <button 
                                onClick={() => handleLikeMessage(m.id)}
                                className={`p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors ${
                                  likedMessages.has(m.id) ? 'bg-red-200 dark:bg-red-900' : ''
                                }`}
                                title="Like"
                              >
                                <Heart className={`w-3 h-3 ${
                                  likedMessages.has(m.id) ? 'fill-red-500 text-red-500' : 'text-slate-700 dark:text-slate-300'
                                }`} />
                              </button>
                              <button 
                                onClick={() => handleShareMessage(m.id, m.message)}
                                className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </TabsContent>
            )}

            <TabsContent value="matches" className="m-0 p-4 h-full data-[state=inactive]:hidden overflow-y-auto">
              {(!matches || matches.length === 0) ? (
                <div className="text-center text-slate-500 py-20">
                  <Users className="w-12 h-12 mb-4 mx-auto opacity-20" />
                  <p>No active matches for this challenge yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m: any) => {
                    const user = m.user;
                    const matched = m.matchedWithUser;
                    return (
                      <div key={m.entry?.id || m.entry?.userId || Math.random()} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3">
                          <UserAvatar userId={user?.id} username={user?.username} size={40} />
                          <div className="flex flex-col">
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {user?.firstName || user?.username || 'User'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Matched with</div>
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {matched?.firstName || matched?.username || 'Opponent'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="m-0 p-4 h-full data-[state=inactive]:hidden overflow-y-auto">
              {activityEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p>No activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activityEvents.map((event: ActivityEvent) => {
                    const getActivityIcon = () => {
                      if (event.action.includes('created challenge')) {
                        return <Zap className="w-4 h-4 text-blue-500" />;
                      } else if (event.action.includes('added') && event.action.includes('bonus')) {
                        return <Trophy className="w-4 h-4 text-yellow-500" />;
                      } else if (event.action.includes('awaiting participants')) {
                        return <Users className="w-4 h-4 text-slate-400" />;
                      } else if (event.action.includes('defeated') || event.action.includes('Winner')) {
                        return <Trophy className="w-4 h-4 text-yellow-500" />;
                      } else if (event.action.includes('Payout') || event.action.includes('coins')) {
                        return <DollarSign className="w-4 h-4 text-green-500" />;
                      } else if (event.action.includes('joined')) {
                        return <UserPlus className="w-4 h-4 text-blue-500" />;
                      } else if (event.action.includes('matched')) {
                        return <Zap className="w-4 h-4 text-purple-500" />;
                      }
                      return <Activity className="w-4 h-4 text-slate-400" />;
                    };

                    return (
                      <div key={event.id} className="flex gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                        <div className="flex-shrink-0 flex items-start pt-1">
                          {event.user ? (
                            <UserAvatar userId={event.user.id} username={event.user.username} size={32} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                              {getActivityIcon()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 dark:text-slate-100">
                            {event.user ? (
                              <>
                                <span className="font-medium">
                                  {event.user.firstName || event.user.username || 'User'}
                                </span>{' '}
                                <span className="text-slate-600 dark:text-slate-400">{event.action}</span>
                              </>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-400 italic">{event.action}</span>
                            )}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex-shrink-0">
                          {getActivityIcon()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {isAuthenticated && !shouldHideCommentsTab && activeTab === 'comments' && (
          <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 fixed bottom-0 left-0 right-0 flex flex-col gap-2 z-50 max-w-4xl mx-auto w-full">
            {replyingTo && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500 rounded">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Replying to: {messages.find(m => m.id === replyingTo)?.user?.firstName || 'User'}
                </span>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  className="pr-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>
              <Button 
                size="icon" 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="rounded-full shadow-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        
        {selectedProfileUserId && <ProfileCard userId={selectedProfileUserId} onClose={() => setSelectedProfileUserId(null)} />}
      </div>
    </div>
  );
}
