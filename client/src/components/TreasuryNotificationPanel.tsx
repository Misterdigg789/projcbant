/**
 * Treasury Notification Display Component
 * Shows user and admin Treasury notifications with real-time updates
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Badge,
  Button,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/';
import { CheckCircle2, AlertCircle, Trophy, TrendingDown, Bell } from 'lucide-react';

interface TreasuryNotification {
  id: number;
  userId: string;
  event: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

interface NotificationGroup {
  type: 'match' | 'settlement' | 'admin';
  title: string;
  description: string;
  notifications: TreasuryNotification[];
  icon: React.ReactNode;
}

/**
 * Fetch Treasury notifications for current user
 */
async function fetchTreasuryNotifications(
  userId: string
): Promise<TreasuryNotification[]> {
  const response = await fetch(
    `/api/notifications?userId=${userId}&treasuryOnly=true`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  );

  if (!response.ok) throw new Error('Failed to fetch notifications');
  return response.json();
}

/**
 * Mark notification as read
 */
async function markAsRead(notificationId: number): Promise<void> {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  if (!response.ok) throw new Error('Failed to mark as read');
}

/**
 * Delete notification
 */
async function deleteNotification(notificationId: number): Promise<void> {
  const response = await fetch(`/api/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  if (!response.ok) throw new Error('Failed to delete notification');
}

/**
 * Treasury Match Notification Card
 */
function TreasuryMatchCard({
  notification,
  onRead,
  onDelete,
}: {
  notification: TreasuryNotification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const data = notification.data as any;
  const opponentName = data?.opponentName || 'Unknown';
  const amount = data?.opponentStaked || 0;

  return (
    <div
      className={`p-4 border rounded-lg transition-colors ${
        notification.read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-xs text-gray-600">
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {!notification.read && <Badge variant="default">New</Badge>}
      </div>

      <p className="text-sm text-gray-700 mb-2">{notification.message}</p>

      <div className="bg-white p-2 rounded border text-xs mb-2">
        <p>
          <strong>Opponent:</strong> {opponentName}
        </p>
        <p>
          <strong>Stake:</strong> ₦{amount.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-2">
        {!notification.read && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRead(notification.id)}
          >
            Mark as Read
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(notification.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * Settlement Notification Card
 */
function SettlementCard({
  notification,
  onRead,
  onDelete,
}: {
  notification: TreasuryNotification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const data = notification.data as any;
  const result = data?.result || 'unknown';
  const payout = data?.payout || 0;
  const opponentName = data?.opponentName || 'Treasury';

  const isWin = result === 'won';
  const bgColor = isWin ? 'bg-green-50' : 'bg-red-50';
  const borderColor = isWin ? 'border-green-200' : 'border-red-200';
  const iconColor = isWin ? 'text-green-600' : 'text-red-600';
  const icon = isWin ? (
    <Trophy className={`w-5 h-5 ${iconColor}`} />
  ) : (
    <AlertCircle className={`w-5 h-5 ${iconColor}`} />
  );

  return (
    <div className={`p-4 border rounded-lg ${bgColor} ${borderColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-xs text-gray-600">
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {!notification.read && <Badge variant="default">New</Badge>}
      </div>

      <p className="text-sm text-gray-700 mb-2">{notification.message}</p>

      <div className="bg-white p-2 rounded border text-xs mb-2">
        <p>
          <strong>Opponent:</strong> {opponentName}
        </p>
        <p>
          <strong>Result:</strong>{' '}
          <span className={isWin ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
            {isWin ? 'WON' : 'LOST'} ₦{Math.abs(payout).toLocaleString()}
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        {!notification.read && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRead(notification.id)}
          >
            Mark as Read
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(notification.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * Admin Settlement Summary Card
 */
function AdminSettlementCard({
  notification,
  onRead,
  onDelete,
}: {
  notification: TreasuryNotification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const data = notification.data as any;
  const matchesSettled = data?.matchesSettled || 0;
  const wonCount = data?.wonCount || 0;
  const lostCount = data?.lostCount || 0;
  const netProfit = data?.netProfit || 0;

  const isProfit = netProfit > 0;

  return (
    <div
      className={`p-4 border rounded-lg ${
        isProfit ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isProfit ? (
            <Trophy className="w-5 h-5 text-green-600" />
          ) : (
            <TrendingDown className="w-5 h-5 text-orange-600" />
          )}
          <div>
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            <p className="text-xs text-gray-600">
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {!notification.read && <Badge variant="default">New</Badge>}
      </div>

      <p className="text-sm text-gray-700 mb-2">{notification.message}</p>

      <div className="bg-white p-3 rounded border text-xs grid grid-cols-2 gap-2 mb-2">
        <p>
          <strong>Settled:</strong> {matchesSettled}
        </p>
        <p>
          <strong>Won:</strong> {wonCount}
        </p>
        <p>
          <strong>Lost:</strong> {lostCount}
        </p>
        <p className={isProfit ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
          <strong>Net:</strong> ₦{netProfit.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-2">
        {!notification.read && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRead(notification.id)}
          >
            Mark as Read
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(notification.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * Main Treasury Notification Panel
 */
export function TreasuryNotificationPanel({
  userId,
  isAdmin = false,
}: {
  userId: string;
  isAdmin?: boolean;
}) {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['treasuryNotifications', userId],
    queryFn: () => fetchTreasuryNotifications(userId),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Mark as read mutation
  const { mutate: markRead } = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasuryNotifications', userId] });
    },
  });

  // Delete mutation
  const { mutate: deleteNotif } = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasuryNotifications', userId] });
    },
  });

  // Group notifications by type
  const groups: NotificationGroup[] = [];

  const matchNotifs = notifications.filter(n => n.event === 'match.found');
  if (matchNotifs.length > 0) {
    groups.push({
      type: 'match',
      title: 'Match Created',
      description: 'You have been matched with Treasury',
      notifications: matchNotifs,
      icon: <Bell className="w-4 h-4" />,
    });
  }

  const settlementNotifs = notifications.filter(n => n.event === 'challenge.settled');
  if (settlementNotifs.length > 0) {
    groups.push({
      type: 'settlement',
      title: 'Challenge Settled',
      description: 'Your challenges have been resolved',
      notifications: settlementNotifs,
      icon: <CheckCircle2 className="w-4 h-4" />,
    });
  }

  const adminNotifs = notifications.filter(
    n => n.event === 'admin.treasury.settlement' || n.event === 'admin.treasury.match_created'
  );
  if (isAdmin && adminNotifs.length > 0) {
    groups.push({
      type: 'admin',
      title: 'Treasury Events',
      description: 'Admin Treasury actions',
      notifications: adminNotifs,
      icon: <Trophy className="w-4 h-4" />,
    });
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Treasury Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Loading notifications...</p>
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Treasury Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center py-6">No Treasury notifications yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Treasury Notifications</CardTitle>
            <CardDescription>Real-time updates on matches and settlements</CardDescription>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {groups.length === 1 ? (
          <div className="space-y-3">
            {groups[0].notifications.map(notif => {
              if (notif.event === 'match.found') {
                return (
                  <TreasuryMatchCard
                    key={notif.id}
                    notification={notif}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                );
              } else if (notif.event === 'challenge.settled') {
                return (
                  <SettlementCard
                    key={notif.id}
                    notification={notif}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                );
              } else if (notif.event === 'admin.treasury.settlement') {
                return (
                  <AdminSettlementCard
                    key={notif.id}
                    notification={notif}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                );
              }
              return null;
            })}
          </div>
        ) : (
          <Tabs defaultValue={groups[0].type}>
            <TabsList className="w-full">
              {groups.map(group => (
                <TabsTrigger key={group.type} value={group.type} className="flex-1">
                  <span className="flex items-center gap-1">
                    {group.icon}
                    {group.title}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.map(group => (
              <TabsContent key={group.type} value={group.type}>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {group.notifications.map(notif => {
                      if (notif.event === 'match.found') {
                        return (
                          <TreasuryMatchCard
                            key={notif.id}
                            notification={notif}
                            onRead={markRead}
                            onDelete={deleteNotif}
                          />
                        );
                      } else if (notif.event === 'challenge.settled') {
                        return (
                          <SettlementCard
                            key={notif.id}
                            notification={notif}
                            onRead={markRead}
                            onDelete={deleteNotif}
                          />
                        );
                      } else if (notif.event === 'admin.treasury.settlement') {
                        return (
                          <AdminSettlementCard
                            key={notif.id}
                            notification={notif}
                            onRead={markRead}
                            onDelete={deleteNotif}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

export default TreasuryNotificationPanel;
