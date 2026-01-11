import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Users, Trophy } from "lucide-react";

interface JoinChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: {
    id: number;
    title: string;
    category: string;
    amount: string;
    description?: string;
  };
  userBalance: number;
}

export function JoinChallengeModal({
  isOpen,
  onClose,
  challenge,
  userBalance,
}: JoinChallengeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO" | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  
  const stakeAmount = parseInt(challenge.amount) || 0;
  const potentialWin = stakeAmount * 2; // Simple 2x payout logic for P2P

  const getCategoryEmoji = (category: string) => {
    const cats: Record<string, string> = {
      crypto: "🪙",
      sports: "⚽",
      gaming: "🎮",
      music: "🎵",
      politics: "⚖️",
      tech: "💻",
      lifestyle: "✨",
      entertainment: "🎭"
    };
    return cats[category.toLowerCase()] || "🏆";
  };

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSide) {
        throw new Error("Please select YES or NO");
      }

      if (stakeAmount <= 0) {
        throw new Error("Invalid stake amount");
      }

      if (stakeAmount > userBalance) {
        throw new Error("Insufficient balance");
      }

      return await apiRequest("POST", `/api/challenges/${challenge.id}/join`, {
        stake: selectedSide,
      });
    },
    onSuccess: (result) => {
      setIsWaiting(true);
      
      // Differentiate between instant match and queue waiting
      if (result.match) {
        // Instant match found!
        toast({
          title: "✅ Matched!",
          description: `Opponent found! ₦${stakeAmount} locked in escrow.`,
        });
      } else {
        // Added to queue, waiting for opponent
        toast({
          title: "⏳ Queued for matching",
          description: `Position ${result.queuePosition} in queue. ₦${stakeAmount} held in escrow.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });

      setTimeout(() => {
        onClose();
        setIsWaiting(false);
        setSelectedSide(null);
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleJoin = () => {
    joinMutation.mutate();
  };

  const isBalanceSufficient = userBalance >= stakeAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs p-3 rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4 text-yellow-500" />
            Join Challenge
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Predict the outcome 🔮</DialogDescription>
        </DialogHeader>
         
        <div className="space-y-4 py-2">
          {/* Section Banner: Challenge Details */}
          <div className="bg-slate-900 dark:bg-slate-800 px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase italic tracking-wider">Challenge Entry ⚡</span>
            <Zap className="w-3 h-3 text-white/40" />
          </div>

          <div className="bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-b-md p-3 -mt-4">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
                {challenge.title}
              </h3>
              
              <div className="flex flex-wrap items-center justify-between gap-y-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 dark:bg-slate-700 border-0 px-2 font-medium">
                      <span className="mr-1">{getCategoryEmoji(challenge.category)}</span>
                      {challenge.category}
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Stake: ₦{stakeAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                      WINNINGS: ₦{potentialWin.toLocaleString()} 💰
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBalanceSufficient ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'}`}>
                    {isBalanceSufficient ? '✓ FUNDED' : '✗ INSUFFICIENT'}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    Earnings: ₦{userBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Banner: Selection */}
          <div className="bg-primary px-3 py-1.5 rounded-t-md flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase italic tracking-wider">Your Claim 🗣️</span>
            <Trophy className="w-3 h-3 text-white/40" />
          </div>

          <div className="grid grid-cols-2 gap-2 -mt-4">
            <button
              onClick={() => setSelectedSide("YES")}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "YES" ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white'
              }`}
              data-testid="button-choice-yes"
            >
              ✓ YES
            </button>
            <button
              onClick={() => setSelectedSide("NO")}
              className={`py-2 rounded-md text-sm font-semibold transition-all ${
                selectedSide === "NO" ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white'
              }`}
              data-testid="button-choice-no"
            >
              ✗ NO
            </button>
          </div>

          {/* Waiting State (compact) */}
          {isWaiting && (
            <div className="p-2 text-center text-sm text-slate-600 bg-slate-50 dark:bg-slate-800/30 rounded-md">Processing... Your stake is locked. Finding a match...</div>
          )}
        </div>

        {/* Action Buttons (compact) */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleJoin}
            disabled={!selectedSide || !isBalanceSufficient || joinMutation.isPending}
            className="w-full border-0"
            size="sm"
            data-testid="button-confirm-join"
          >
            {joinMutation.isPending ? "Joining..." : "Join"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
