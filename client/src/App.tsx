import React, { useEffect, useState } from "react";
import { Router, Switch, Route, useLocation } from "wouter";
import { apiRequest, queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { EventsSearchProvider } from "./context/EventsSearchContext";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from '@/hooks/use-toast';
import { initializeFCM } from "@/services/pushNotificationService";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Events from "./pages/Events";
import EventCreate from "./pages/EventCreate";
import Challenges from "./pages/Challenges";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import ProfileSettings from "./pages/ProfileSettings";
import History from "./pages/History";
import Notifications from "./pages/Notifications";
import WalletPage from "@/pages/WalletPage";
import Shop from "@/pages/Shop";
import ReferralNew from "./pages/ReferralNew";
import Settings from "@/pages/Settings";
import SupportChat from "@/pages/SupportChat";
import HelpSupport from "@/pages/HelpSupport";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import DataDeletionRequest from "@/pages/DataDeletionRequest";
import Leaderboard from "./pages/Leaderboard";
import About from "./pages/About";
import PointsAndBadges from "./pages/PointsAndBadges";
import ChallengeDetail from "./pages/ChallengeDetail";
import Recommendations from "./pages/Recommendations";
import EventChatPage from "./pages/EventChatPage";
import AdminDashboardOverview from "./pages/AdminDashboardOverview";
import AdminEventPayouts from "./pages/AdminEventPayouts";
import AdminChallengePayouts from "./pages/AdminChallengePayouts";
import AdminChallengeCreate from "./pages/AdminChallengeCreate";
import AdminChallengeDisputes from "./pages/AdminChallengeDisputes";
import AdminTransactions from "./pages/AdminTransactions";
import AdminPayouts from "./pages/AdminPayouts";
import AdminPayoutDashboard from "./pages/AdminPayoutDashboard";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminBonusConfiguration from "./pages/AdminBonusConfiguration";
import AdminNotifications from "@/pages/AdminNotifications";
import AdminUsersManagement from "./pages/AdminUsersManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminWallet from "./pages/AdminWallet";

import { DailyLoginModal } from '@/components/DailyLoginModal';
import { useDailyLoginPopup } from '@/hooks/useDailyLoginPopup';
import AdminLogin from "@/pages/AdminLogin";
import { WebsiteTour, useTour } from "@/components/WebsiteTour";
import { SplashScreen } from "@/components/SplashScreen";
import AddToHomePrompt from "@/components/AddToHomePrompt";
import TelegramTest from "./pages/TelegramTest";
import TelegramLink from "@/pages/TelegramLink";
import Bantzz from "./pages/Bantzz";
import Stories from "./pages/Stories";
import BantMap from "./pages/BantMap";
import NotificationTest from "./pages/NotificationTest";
import PublicProfile from "@/pages/PublicProfile";
import { Navigation } from "@/components/Navigation";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense, lazy } from "react";
import EventDetails from "./pages/EventDetails";
import ChallengeChatPage from "./pages/ChallengeChatPage";
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig } from './lib/privyConfig';

function AppRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Initialize tour
  const tour = useTour();

  // Add global tour event listener
  useEffect(() => {
    const handleStartTour = () => {
      tour.startTour();
    };

    window.addEventListener('start-tour', handleStartTour);

    return () => {
      window.removeEventListener('start-tour', handleStartTour);
    };
  }, [tour]);

  // Initialize Firebase Cloud Messaging for push notifications
  useEffect(() => {
    initializeFCM().catch(err => console.log('FCM initialization skipped in dev or no permission', err));
  }, []);

  // Initialize notifications for authenticated users
  const notifications = useNotifications();

  const { toast } = useToast();

  // Initialize automatic daily login popup
  const { showDailyLoginPopup, closeDailyLoginPopup, dailyLoginStatus } = useDailyLoginPopup();

  // Auto-complete Telegram link flow after login
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const telegramTokenFromUrl = params.get('telegram_token');
      const telegramTokenFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('telegram_token') : null;
      const telegramToken = telegramTokenFromUrl || telegramTokenFromStorage;

      if (!telegramToken) return;

      // If token exists in sessionStorage but user isn't on /telegram-link, navigate there (no reload)
      try {
        const stored = telegramTokenFromStorage;
        if (stored && !telegramTokenFromUrl && window.location.pathname !== '/telegram-link') {
          const newPath = `/telegram-link?telegram_token=${stored}`;
          window.history.replaceState({}, '', newPath);
        }
      } catch (_) {}

      (async () => {
        const maxAttempts = 5;
        let attempt = 0;
        let success = false;

        while (attempt < maxAttempts && !success) {
          attempt += 1;
          try {
            const res = await apiRequest('GET', `/api/telegram/verify-link?token=${telegramToken}`);

            if (res && res.success) {
              toast({ title: 'Telegram Linked', description: 'Your Telegram account was linked after sign-in.' });
              success = true;
              break;
            } else {
              // If backend reports invalid token or already linked, stop retrying
              toast({ title: 'Telegram Link Failed', description: res?.message || 'Unable to link Telegram account', variant: 'destructive' });
              break;
            }
          } catch (err: any) {
            // If auth wasn't ready yet (401) or token not present, retry after a short delay
            const message = String(err.message || err);
            const isAuthError = message.includes('401') || message.toLowerCase().includes('authorization');

            if (isAuthError && attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, attempt * 1000));
              continue;
            }

            // Non-auth error or out of retries
            toast({ title: 'Telegram Link Error', description: 'Failed to verify Telegram link after sign-in', variant: 'destructive' });
            break;
          }
        }

        // cleanup
        try {
          params.delete('telegram_token');
          const newSearch = params.toString();
          const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, '', newUrl);
        } catch (_) {}

        try {
          sessionStorage.removeItem('telegram_token');
        } catch (_) {}
      })();
    } catch (error) {
      // ignore
    }
  }, [isAuthenticated, isLoading, toast]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if current location is an admin route
  const isAdminRoute = location.startsWith('/admin');

  return (
    <div className="min-h-screen transition-all duration-300 ease-in-out">
      {/* Show Navigation for all users except on landing page and admin routes */}
      {!isLoading && !isAdminRoute && (
        <div className="sticky top-0 z-50">
          <Navigation />
        </div>
      )}

      <Switch>
      {/* Admin Login Route - Always Available */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin-login" component={AdminLogin} />

      {/* Public profile routes - accessible to everyone */}
      <Route path="/@:username" component={PublicProfile} />
      <Route path="/u/:username" component={PublicProfile} />

      {/* Telegram link - public (used by Telegram web login) */}
      <Route path="/telegram-link" component={TelegramLink} />
      <Route path="/telegram-auth" component={TelegramLink} />
      {/* Public Routes - Accessible to everyone */}
      <Route path="/about" component={About} />
      <Route path="/events/:id/chat" component={EventChatPage} />
      <Route path="/challenges/:id/activity" component={ChallengeChatPage} />
      <Route path="/challenges/:id/chat" component={ChallengeChatPage} />
      <Route path="/events/:id" component={EventDetails} />
      <Route path="/event/:id" component={EventChatPage} />

      {/* Admin routes - accessible regardless of main authentication state */}
      <Route path="/admin" component={AdminDashboardOverview} />
      <Route path="/admin/payouts" component={AdminPayoutDashboard} />
      <Route path="/admin/events" component={AdminEventPayouts} />
      <Route path="/admin/challenges" component={AdminChallengePayouts} />
      <Route path="/admin/challenges/create" component={AdminChallengeCreate} />
      <Route path="/admin/challenges/disputes" component={AdminChallengeDisputes} />
      <Route path="/admin/transactions" component={AdminTransactions} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/bonuses" component={AdminBonusConfiguration} />
      <Route path="/admin/wallet" component={AdminWallet} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/users" component={AdminUsersManagement} />
      <Route path="/admin/settings" component={AdminSettings} />

      {isLoading ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/ref/:code" component={Landing} />
        </>
      ) : !isAuthenticated ? (
        <>
          <Route path="/" component={Challenges} />
          <Route path="/events" component={Events} />
          <Route path="/home" component={Home} />
          <Route path="/recommendations" component={Recommendations} />
          <Route path="/challenges" component={Challenges} />
          <Route path="/challenges/:id" component={ChallengeDetail} />
          <Route path="/friends" component={Friends} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/points" component={PointsAndBadges} />
          <Route path="/ref/:code" component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Challenges} />
          <Route path="/events" component={Events} />
          <Route path="/home" component={Home} />
          <Route path="/events/create" component={EventCreate} />
          <Route path="/create" component={EventCreate} />
          <Route path="/recommendations" component={Recommendations} />
          <Route path="/challenges" component={Challenges} />
          <Route path="/challenges/:id" component={ChallengeDetail} />
          <Route path="/friends" component={Friends} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/shop" component={Shop} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/points" component={PointsAndBadges} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/profile" component={Profile} />
          <Route path="/profile/edit" component={ProfileEdit} />
          <Route path="/profile/settings" component={ProfileSettings} />
          <Route path="/referrals" component={ReferralNew} />
          <Route path="/history" component={History} />
          <Route path="/settings" component={Settings} />
          <Route path="/support-chat" component={SupportChat} />
          <Route path="/help-support" component={HelpSupport} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/data-deletion-request" component={DataDeletionRequest} />
          <Route path="/telegram/test" component={TelegramTest} />
          <Route path="/telegram-auth" component={TelegramLink} />
          <Route path="/telegram-link" component={TelegramLink} />
          <Route path="/bantzz" component={Bantzz} />
          <Route path="/stories" component={Stories} />
          <Route path="/bant-map" component={BantMap} />
          <Route path="/notifications/test" component={NotificationTest} />
          <Route path="/ref/:code" component={Landing} />
        </>
      )}

      {/* Catch-all route for undefined paths - must be last */}
      <Route path="/:rest*" component={NotFound} />
    </Switch>



    {/* Automatic Daily Login Popup */}
    {isAuthenticated && (
      <DailyLoginModal 
        isOpen={showDailyLoginPopup}
        onClose={closeDailyLoginPopup}
        currentStreak={(dailyLoginStatus as any)?.streak || 0}
        hasClaimedToday={(dailyLoginStatus as any)?.hasSignedInToday || false}
        canClaim={(dailyLoginStatus as any)?.canClaim || false}
      />
    )}

    {/* Website Tour */}
    {isAuthenticated && (
      <WebsiteTour 
        isOpen={tour.isOpen}
        onClose={tour.closeTour}
      />
    )}
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={privyConfig.appId}
        config={privyConfig.config}
      >
        <ThemeProvider>
          <EventsSearchProvider>
            <div className={`${isMobile ? 'mobile-app' : ''}`}>
              {showSplash ? (
                <SplashScreen onComplete={handleSplashComplete} />
              ) : (
                <TooltipProvider>
                  <Toaster />
                  <AddToHomePrompt />
                  <ErrorBoundary
                    fallback={<div className="p-4 text-center">Something went wrong. Please refresh the page.</div>}
                    onError={(error) => console.error("App Error:", error)}
                  >
                    <Router>
                      <AppRouter />
                    </Router>
                  </ErrorBoundary>
                </TooltipProvider>
              )}
            </div>
          </EventsSearchProvider>
        </ThemeProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

export default App;