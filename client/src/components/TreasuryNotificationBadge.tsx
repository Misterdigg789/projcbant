/**
 * Treasury Notification Badge
 * Shows unread count in header/navbar
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  userId: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Fetch unread notification count
 */
async function fetchUnreadCount(userId: string): Promise<number> {
  const response = await fetch(`/api/notifications/unread-count?userId=${userId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch unread count');
  const data = await response.json();
  return data.count;
}

/**
 * Treasury Notification Badge Component
 * Displays unread notification count with bell icon
 */
export function TreasuryNotificationBadge({
  userId,
  className = '',
  onClick,
}: NotificationBadgeProps) {
  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ['unreadNotificationCount', userId],
    queryFn: () => fetchUnreadCount(userId),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className={`relative cursor-pointer ${className}`}>
        <Bell className="w-5 h-5 text-gray-600" />
      </div>
    );
  }

  return (
    <div
      className={`relative cursor-pointer ${className}`}
      onClick={onClick}
    >
      <Bell className="w-5 h-5 text-gray-600" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  );
}

export default TreasuryNotificationBadge;
