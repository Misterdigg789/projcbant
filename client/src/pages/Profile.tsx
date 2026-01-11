import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { formatBalance } from "@/utils/currencyUtils";
import { getAvatarUrl } from "@/utils/avatarUtils";
import { getLevelIcon, getLevelName } from "@/utils/levelSystem";
import { useLocation } from "wouter";
import {
  ChevronRight,
  Edit,
  Users,
  Star,
  Trophy,
  FileText,
  Shield,
  Trash2,
  QrCode,
  Info,
} from "lucide-react";
import { ProfileQRCode } from "@/components/ProfileQRCode";

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const {
    data: userStats = {} as { wins?: number; activeChallenges?: number },
  } = useQuery({
    queryKey: ["/api/user/stats"],
    retry: false,
  });

  const { data: userProfile } = useQuery({
    queryKey: [`/api/users/${user.id}/profile`],
    enabled: !!user?.id,
    retry: false,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["/api/user/achievements"],
    retry: false,
  });

  if (!user) return null;

  // Prefer server-side profile values (username, firstName) when available.
  const displayName =
    userProfile?.firstName || user.firstName || (user as any)?.name || userProfile?.username || user.username || 'User'
  const usernameToShow = userProfile?.username || user.username || '';

  const shareProfile = () => {
    const currentUsername = usernameToShow || userProfile?.username || user.username;
    if (!currentUsername) {
      toast({
        title: "Error",
        description: "Username not found. Please set a username in settings.",
        variant: "destructive"
      });
      return;
    }
    const shareUrl = `${window.location.origin}/@${currentUsername}`;
    if (navigator.share) {
      navigator.share({
        title: 'Check out my profile on BetChat',
        url: shareUrl
      }).catch(() => {
        navigator.clipboard.writeText(shareUrl);
        toast({ title: "Copied!", description: "Profile link copied to clipboard" });
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Copied!", description: "Profile link copied to clipboard" });
    }
  };

  const handleCopyReferralCode = async () => {
    if (user?.referralCode) {
      await navigator.clipboard.writeText(user.referralCode);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    }
  };

  return (
    <MobileLayout noCard>
      <div className="min-h-screen theme-transition flex flex-col pb-[50px]">
        <div className="flex-1 flex flex-col items-center w-full">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Profile Card */}
            <div className="relative bg-white rounded-3xl px-6 pt-6 pb-5 mb-6 border border-[#f0f1fa] shadow-sm">
              {/* Top section with referral code */}
              <div className="flex justify-end mb-4"></div>

              {/* Profile info section */}
              <div className="flex flex-col items-center">
                {/* Avatar with edit button */}
                <div className="relative mb-4">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage
                        src={getAvatarUrl(user?.id, user?.username || displayName)}
                        alt={displayName}
                      />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {(displayName?.charAt(0) || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Edit profile button */}
                    <button
                      type="button"
                      onClick={() => navigate("/Profile/edit")}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#CCFF00] text-black shadow hover:bg-[#e6ff70] transition"
                      aria-label="Edit Profile"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Level badge */}
                  <div className="absolute -bottom-1 left-2">
                    <Badge className="bg-[#7440ff] text-white text-xs px-2 py-1">
                      x {user.level}
                    </Badge>
                  </div>
                </div>

                {/* User info */}
                <h2 className="text-xl font-bold text-gray-900 mb-1 tracking-tight">
                  {displayName}
                </h2>
                {usernameToShow ? (
                  <p className="text-gray-500 text-sm mb-3">@{usernameToShow}</p>
                ) : null}

                {/* Bio */}
                {(userProfile?.bio || user.bio) && (
                  <p className="text-gray-700 text-center mb-4 max-w-xs text-sm leading-tight">
                    {userProfile?.bio || user.bio || ""}
                  </p>
                )}

                {/* Stats section - Compact Social Style */}
                <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                  {/* Level */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full">
                      <img
                        src={getLevelIcon(user.level || 1)}
                        alt={getLevelName(user.level || 1)}
                        className="w-4 h-4"
                      />
                      <span className="font-semibold text-xs sm:text-sm">
                        {getLevelName(user.level || 1)}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">
                      Level {user.level || 1}
                    </span>
                  </div>

                  {/* Points */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full">
                      <Star className="w-4 h-4" />
                      <span className="font-semibold text-xs sm:text-sm">
                        {formatBalance(user.points || 0)}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">Points</span>
                  </div>

                  {/* Followers */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-cyan-100 text-cyan-700 rounded-full">
                      <Users className="w-4 h-4" />
                      <span className="font-semibold text-xs sm:text-sm">
                        {userProfile?.followerCount || user.followerCount || 0}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">
                      Followers
                    </span>
                  </div>

                  {/* Following */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full">
                      <Users className="w-4 h-4" />
                      <span className="font-semibold text-xs sm:text-sm">
                        {userProfile?.followingCount || user.followingCount || 0}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">
                      Following
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Sections */}
            <div className="space-y-6">
              {/* My Account Section */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Referrals & Badges
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => navigate("/points")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-trophy text-purple-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Levels & Badges</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/referrals")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-share-alt text-yellow-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Refer & Earn</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/about")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                      <Info className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">About Bantah</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/history")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-history text-blue-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">History</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <div className="w-full flex items-center px-4 py-4">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Share Profile QR</div>
                    </div>
                    <ProfileQRCode
                      username={user.username}
                      fullName={user.firstName || user.username}
                      profileImageUrl={user.profileImageUrl}
                      size="sm"
                      trigger={
                        <Button variant="outline" size="sm" className="px-3">
                          <QrCode className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={shareProfile}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-t border-slate-100 dark:border-slate-800"
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-share-alt text-indigo-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Share Public Profile</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Support Section */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Settings & Support
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-comments text-green-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Settings</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/support-chat")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-comments text-green-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Support Chat</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/help-support")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-question-circle text-indigo-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">Help & Support</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Settings Section */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Terms, Privacy & Data
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => navigate("/privacy-policy")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-shield-alt text-red-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">
                        Privacy & Security
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/terms-of-service")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-file-alt text-orange-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">
                        Terms of Service
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/data-deletion-request")}
                    className="w-full flex items-center px-4 py-4 text-gray-900 dark:text-gray-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                      <i className="fas fa-trash text-pink-600 text-sm"></i>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">
                        Data Deletion Request
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="w-full py-4 bg-white text-red-500 rounded-2xl font-semibold shadow hover:bg-red-50 transition mb-4 border border-[#f0f1fa] text-sm"
            >
              Logout
            </button>
          </div>
        </div>
        <MobileNavigation />
      </div>
    </MobileLayout>
  );
}