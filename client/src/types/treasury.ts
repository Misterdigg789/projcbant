// Treasury Analytics Types
export interface DailyPnL {
  date: string;
  matches_count: number;
  wins: number;
  losses: number;
  draws: number;
  total_amount_wagered: number;
  total_payout: number;
  net_pnl: number;
  win_rate: number;
}

export interface ChallengeAnalytics {
  challenge_id: string;
  challenge_title: string;
  admin_id: string;
  admin_username: string;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  total_wagered: number;
  total_payout: number;
  net_pnl: number;
  win_rate: number;
  avg_match_amount: number;
  created_at: string;
  settled_at: string | null;
}

export interface TreasuryMetrics {
  total_matches: number;
  total_matches_settled: number;
  pending_settlement: number;
  total_amount_wagered: number;
  total_payouts: number;
  total_net_pnl: number;
  overall_win_rate: number;
  avg_match_size: number;
  days_active: number;
  most_profitable_day: DailyPnL | null;
  most_challenging_day: DailyPnL | null;
}

export interface PerformanceByUser {
  user_id: string;
  username: string;
  is_shadow: boolean;
  matches_count: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  total_wagered: number;
  total_payout: number;
  net_pnl: number;
}

export interface RiskAnalysis {
  date: string;
  max_daily_risk: number;
  actual_daily_loss: number;
  risk_utilization: number;
  challenges_at_risk: number;
  total_exposed: number;
}

export interface DailyReport {
  date: string;
  total_matches: number;
  settled_matches: number;
  wins: number;
  total_wagered: number;
  total_payouts: number;
  net_pnl: number;
  win_rate: number;
}

export interface AnalyticsExport {
  export_date: string;
  metrics: TreasuryMetrics;
  daily_pnl: DailyPnL[];
  challenges: ChallengeAnalytics[];
  user_performance: PerformanceByUser[];
}
