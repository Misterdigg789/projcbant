
// Admin API client with token-based authentication
const getAdminToken = (): string | null => {
  return localStorage.getItem('adminToken');
};

export const adminApiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAdminToken();
  
  if (!token) {
    throw new Error('Admin authentication required');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  // Only set Content-Type if body is not FormData (let browser handle FormData)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/admin/login';
      throw new Error('Admin session expired');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
};

export const isAdminAuthenticated = (): boolean => {
  const token = getAdminToken();
  const userStr = localStorage.getItem('adminUser');
  
  if (!token || !userStr) return false;
  
  try {
    const user = JSON.parse(userStr);
    return user.isAdmin === true;
  } catch {
    return false;
  }
};

// React Query hook for admin queries
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export const useAdminQuery = <TData = unknown>(
  url: string,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<TData>({
    queryKey: [url],
    queryFn: async () => {
      return adminApiRequest(url);
    },
    ...options,
  });
};

// ===== TREASURY MANAGEMENT API FUNCTIONS =====

/**
 * Get imbalance metrics for a challenge
 */
export const getChallengeImbalance = async (challengeId: number) => {
  return adminApiRequest(`/api/admin/challenges/${challengeId}/imbalance`);
};

/**
 * Create Treasury configuration for a challenge
 */
export const createTreasuryConfig = async (
  challengeId: number,
  maxTreasuryRisk: number,
  adminNotes?: string
) => {
  return adminApiRequest(`/api/admin/challenges/${challengeId}/treasury-config`, {
    method: 'POST',
    body: JSON.stringify({
      maxTreasuryRisk,
      adminNotes,
    }),
  });
};

/**
 * Execute Treasury match fulfillment (the "Match All" action)
 */
export const fulfillTreasuryMatches = async (
  challengeId: number,
  matchCount: number,
  sideToFill: 'YES' | 'NO'
) => {
  return adminApiRequest(`/api/admin/challenges/${challengeId}/fulfill-treasury`, {
    method: 'POST',
    body: JSON.stringify({
      matchCount,
      sideToFill,
    }),
  });
};

/**
 * Get Treasury dashboard summary
 */
export const getTreasuryDashboard = async () => {
  return adminApiRequest('/api/admin/treasury/dashboard');
};

/**
 * React Query hook for getting challenge imbalance
 */
export const useGetChallengeImbalance = (
  challengeId: number,
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: [`/api/admin/challenges/${challengeId}/imbalance`],
    queryFn: () => getChallengeImbalance(challengeId),
    ...options,
  });
};

/**
 * React Query hook for getting Treasury dashboard
 */
export const useGetTreasuryDashboard = (
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['/api/admin/treasury/dashboard'],
    queryFn: getTreasuryDashboard,
    ...options,
  });
};
