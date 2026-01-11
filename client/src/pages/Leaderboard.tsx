import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import ProfileCard from "@/components/ProfileCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { getLevelIcon, getLevelName } from "@/utils/levelSystem";

export default function Leaderboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<
    string | null
  >(null);
  const [category, setCategory] = useState<"overall" | "friends">("overall");

  const {
    data: leaderboard = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/leaderboard"],
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle errors with useEffect to prevent infinite re-renders
  useEffect(() => {
    if (error) {
      console.error("Leaderboard error:", error);
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      } else {
        toast({
          title: "Error loading leaderboard",
          description: "Unable to load leaderboard data. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [error, toast]);

  const currentUserRank = Array.isArray(leaderboard)
    ? leaderboard.findIndex((player: any) => player.id === user?.id) + 1
    : 0;

  // Apply category filter (friends support to be added)
  const filteredUsers = Array.isArray(leaderboard) ? leaderboard : [];

  // Skeletons for loading state
  const LeaderboardSkeletons = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={`skeleton-top-${i}`} className="border-2 border-slate-100 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="space-y-1.5 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={`skeleton-row-${i}`} className="flex items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800">
            <Skeleton className="h-6 w-6 mr-3" />
            <Skeleton className="h-8 w-8 rounded-full mr-3" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-2 w-1/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header with Current User Rank */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {user ? (
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Rank <span className="text-[#7440ff]">#{currentUserRank}</span>
                </h1>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 pr-3 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                  <UserAvatar
                    userId={user.id}
                    username={user.username}
                    size={28}
                    className="h-7 w-7"
                  />
                  <div className="flex items-center gap-1">
                    <img
                      src={getLevelIcon(user.level || 1)}
                      alt="Level badge"
                      className="w-4 h-4"
                    />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">
                      Lvl {user.level || 1}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Leaderboard
              </h1>
            )}
          </div>
        </div>

        {isLoading ? (
          <LeaderboardSkeletons />
        ) : !Array.isArray(leaderboard) || leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-trophy text-4xl text-slate-400 mb-4"></i>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              No rankings yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Start playing to appear on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Top 3 Prominent Cards */}
            {filteredUsers.slice(0, 3).map((player: any, index: number) => {
              const cardStyles = [
                "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 dark:from-yellow-950 dark:via-amber-950 dark:to-yellow-950 border-2 border-yellow-300 dark:border-yellow-700",
                "bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-750 dark:to-slate-700 border-2 border-slate-300 dark:border-slate-600",
                "bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950 dark:via-amber-950 dark:to-orange-950 border-2 border-orange-300 dark:border-orange-700",
              ];

              return (
                <Card
                  key={player.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${cardStyles[index]} ${
                    player.id === user?.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedProfileUserId(player.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div
                          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ${
                            index === 0
                              ? "bg-yellow-400 text-white"
                              : index === 1
                                ? "bg-slate-400 text-white"
                                : "bg-orange-400 text-white"
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="relative flex-shrink-0">
                          <UserAvatar
                            userId={player.id}
                            username={player.username}
                            size={40}
                            className="h-10 w-10"
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-white dark:bg-slate-700 border-2 border-white dark:border-slate-700">
                            <img
                              src={getLevelIcon(player.level || 1)}
                              alt={`Level ${player.level || 1} badge`}
                              className="w-4 h-4"
                            />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {player.username}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                              {player.points}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                              <Coins className="w-3 h-3" />
                              <span>{player.coins?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-4">
                        <Badge
                          variant="secondary"
                          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 px-2 py-1 text-[11px]"
                        >
                          {player.challengesWon || 0} Wins
                        </Badge>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-600 dark:text-slate-400">
                            {player.level || 1}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Rest of the Rankings */}
            <div className="space-y-1.5">
              {filteredUsers.slice(3).map((player: any, index: number) => {
                const actualRank = index + 4;
                const isCurrentUser = player.id === user?.id;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer border ${
                      isCurrentUser
                        ? "bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-600 text-white border-slate-700 dark:border-slate-500"
                        : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => setSelectedProfileUserId(player.id)}
                    data-testid={`leaderboard-row-${player.id}`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-8 text-center flex-shrink-0">
                        <span
                          className={`font-bold text-lg ${
                            isCurrentUser
                              ? "text-amber-300"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {actualRank}
                        </span>
                      </div>

                      <div className="relative flex-shrink-0">
                        <UserAvatar
                          userId={player.id}
                          username={player.username}
                          size={32}
                          className="h-8 w-8"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border-1.5 border-white dark:border-slate-800">
                          <img
                            src={getLevelIcon(player.level || 1)}
                            alt={`Level ${player.level || 1} badge`}
                            className="w-2.5 h-2.5"
                          />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-semibold text-sm truncate ${
                            isCurrentUser
                              ? "text-white"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {player.username}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-xs font-medium ${
                              isCurrentUser
                                ? "text-blue-200"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {player.points}
                          </span>
                          <div className={`flex items-center gap-1 text-xs ${
                            isCurrentUser
                              ? "text-amber-200"
                              : "text-slate-500 dark:text-slate-400"
                          }`}>
                            <Coins className="w-3 h-3" />
                            <span>{player.coins?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      {isCurrentUser && (
                        <Badge className="bg-green-600 text-white text-[10px] px-2">
                          TOP{" "}
                          {Math.round((actualRank / leaderboard.length) * 100)}%
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={`${
                          isCurrentUser
                            ? "bg-green-600 text-white border-0"
                            : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-0"
                        } text-[10px] px-2 py-0.5`}
                      >
                        {player.challengesWon || 0}W
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <MobileNavigation />

      {/* Profile Card Modal */}
      {selectedProfileUserId && (
        <ProfileCard
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
        />
      )}
    </div>
  );
}
