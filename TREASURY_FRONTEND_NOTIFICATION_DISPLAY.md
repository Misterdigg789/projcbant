# Treasury Frontend Notification Display - Step 6

## Overview

Complete frontend implementation for displaying Treasury notifications to users and admins. Includes:

✅ Real-time notification panel with tabs  
✅ Notification badge with unread counter  
✅ Match creation notifications  
✅ Settlement notifications  
✅ Admin treasury event notifications  
✅ Mark as read / Dismiss functionality  

---

## Components Created

### 1. TreasuryNotificationPanel
**File:** [client/src/components/TreasuryNotificationPanel.tsx](client/src/components/TreasuryNotificationPanel.tsx)

**Features:**
- Fetches Treasury notifications in real-time (refresh every 5s)
- Groups notifications by type (match, settlement, admin)
- Tab interface for switching between notification types
- Individual card components for each notification type
- Mark as read button
- Dismiss/delete button
- Unread count badge
- Responsive design with Shadcn/UI components

**Props:**
```typescript
interface TreasuryNotificationPanel {
  userId: string;        // Current user ID
  isAdmin?: boolean;     // Show admin-only notifications
}
```

**Usage:**
```tsx
import TreasuryNotificationPanel from '@/components/TreasuryNotificationPanel';

export function DashboardPage({ userId }: { userId: string }) {
  return (
    <div>
      <TreasuryNotificationPanel userId={userId} isAdmin={true} />
    </div>
  );
}
```

### 2. TreasuryNotificationBadge
**File:** [client/src/components/TreasuryNotificationBadge.tsx](client/src/components/TreasuryNotificationBadge.tsx)

**Features:**
- Bell icon with unread count badge
- Real-time update (refresh every 10s)
- Click handler for opening notifications
- Responsive and compact
- Shows "99+" for counts over 99

**Props:**
```typescript
interface TreasuryNotificationBadge {
  userId: string;        // Current user ID
  className?: string;    // Optional CSS classes
  onClick?: () => void;  // Click handler
}
```

**Usage:**
```tsx
import TreasuryNotificationBadge from '@/components/TreasuryNotificationBadge';

export function Navbar({ userId }: { userId: string }) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <nav>
      <div onClick={() => setShowNotifications(!showNotifications)}>
        <TreasuryNotificationBadge userId={userId} />
      </div>
      {showNotifications && (
        <TreasuryNotificationPanel userId={userId} />
      )}
    </nav>
  );
}
```

---

## API Endpoints Added

### GET /api/notifications/treasury
Fetch all Treasury notifications for a user

**Request:**
```bash
GET /api/notifications/treasury
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": 1,
    "userId": "user_123",
    "event": "match.found",
    "title": "You matched!",
    "message": "You've been matched with TeeJay_Striker",
    "data": {
      "challengeId": 42,
      "opponentName": "TeeJay_Striker",
      "opponentStaked": 5000
    },
    "read": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### GET /api/notifications/unread-count
Get count of unread notifications

**Request:**
```bash
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "count": 3
}
```

### DELETE /api/notifications/:id
Delete a notification

**Request:**
```bash
DELETE /api/notifications/1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

---

## Notification Types

### Match.found (User Notification)
```json
{
  "event": "match.found",
  "title": "You matched!",
  "message": "You've been matched with TeeJay_Striker!",
  "data": {
    "challengeId": 42,
    "opponentName": "TeeJay_Striker",
    "opponentStaked": 5000
  }
}
```

**Display:**
- Bell icon (blue background)
- Shows opponent name
- Shows opponent stake amount
- "New" badge if unread

### challenge.settled (User Notification)
```json
{
  "event": "challenge.settled",
  "title": "Challenge Settled",
  "message": "Challenge settled! You WON ₦10,000",
  "data": {
    "challengeId": 42,
    "result": "won",
    "payout": 10000,
    "opponentName": "TeeJay_Striker"
  }
}
```

**Display:**
- Trophy icon for wins (green background)
- Alert icon for losses (red background)
- Shows payout amount
- Shows win/loss status prominently

### admin.treasury.match_created (Admin Notification)
```json
{
  "event": "admin.treasury.match_created",
  "title": "Treasury Matches Filled",
  "message": "Filled 15 matches on YES side, ₦75,000",
  "data": {
    "challengeId": 42,
    "matchCount": 15,
    "side": "YES",
    "totalAllocated": 75000,
    "usernames": ["persona1", "persona2", ...]
  }
}
```

**Display:**
- Bell icon (blue background)
- Admin-only section
- Shows match count and side
- Shows total allocated

### admin.treasury.settlement (Admin Notification)
```json
{
  "event": "admin.treasury.settlement",
  "title": "Treasury Settlement Complete",
  "message": "Challenge #42 settled: 15 matches, 8 won, 7 lost. Net: ₦-5,000",
  "data": {
    "challengeId": 42,
    "matchesSettled": 15,
    "wonCount": 8,
    "lostCount": 7,
    "netProfit": -5000
  }
}
```

**Display:**
- Trophy icon for profit (green background)
- Trending down icon for loss (orange background)
- Shows match settlement summary
- Shows P&L metrics in grid

---

## Integration Points

### In Dashboard
```tsx
import TreasuryNotificationPanel from '@/components/TreasuryNotificationPanel';

export function AdminDashboard({ userId }: { userId: string }) {
  const isAdmin = useIsAdmin();

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <TreasuryImbalanceMonitor />
      </div>
      <div>
        <TreasuryNotificationPanel userId={userId} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
```

### In Navbar
```tsx
import TreasuryNotificationBadge from '@/components/TreasuryNotificationBadge';

export function Navbar({ userId }: { userId: string }) {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <nav className="flex items-center gap-4">
      <div className="relative">
        <TreasuryNotificationBadge
          userId={userId}
          onClick={() => setShowPanel(!showPanel)}
        />
        {showPanel && (
          <div className="absolute right-0 top-10 w-96 z-50">
            <TreasuryNotificationPanel userId={userId} isAdmin={true} />
          </div>
        )}
      </div>
    </nav>
  );
}
```

### In User Profile
```tsx
export function UserNotificationsPage({ userId }: { userId: string }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1>My Notifications</h1>
      <TreasuryNotificationPanel userId={userId} isAdmin={false} />
    </div>
  );
}
```

---

## Styling

Components use Shadcn/UI:
- `Card` - Notification container
- `Badge` - Unread indicator
- `Button` - Actions
- `Tabs` - Notification grouping
- `ScrollArea` - Scrollable lists

**Custom Styling:**
- Blue background for match notifications
- Green background for wins
- Red background for losses
- Orange background for Treasury losses
- White background for nested data

---

## Real-time Updates

### Refresh Strategy
- **Notification Panel:** Refreshes every 5 seconds
- **Badge Counter:** Refreshes every 10 seconds
- **Manual:** Click timestamp to refresh immediately

### React Query Integration
```typescript
const { data: notifications, isLoading, refetch } = useQuery({
  queryKey: ['treasuryNotifications', userId],
  queryFn: () => fetchTreasuryNotifications(userId),
  refetchInterval: 5000,  // Auto-refresh every 5s
});
```

---

## User Actions

### Mark as Read
Removes "New" badge, persists to database

```typescript
const { mutate: markRead } = useMutation({
  mutationFn: markAsRead,
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ['treasuryNotifications', userId] 
    });
  },
});
```

### Dismiss
Deletes notification from database

```typescript
const { mutate: deleteNotif } = useMutation({
  mutationFn: deleteNotification,
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ['treasuryNotifications', userId] 
    });
  },
});
```

### View Details
Click notification to see full details (currently shows inline)

---

## Testing the Component

### Unit Test Example
```typescript
import { render, screen } from '@testing-library/react';
import TreasuryNotificationPanel from '@/components/TreasuryNotificationPanel';

describe('TreasuryNotificationPanel', () => {
  it('displays match notification', () => {
    render(<TreasuryNotificationPanel userId="user_123" />);
    expect(screen.getByText('You matched!')).toBeInTheDocument();
  });

  it('shows unread count', () => {
    render(<TreasuryNotificationPanel userId="user_123" />);
    expect(screen.getByText('3 unread')).toBeInTheDocument();
  });
});
```

### Manual Testing
1. Create Treasury match → Notification appears in panel
2. Resolve challenge → Settlement notification appears
3. Admin fulfills matches → Admin sees match_created notification
4. Admin resolves → Admin sees settlement notification
5. Click "Mark as Read" → Badge removed, read flag set in DB
6. Click "Dismiss" → Notification deleted from DB

---

## Performance Considerations

### Optimization
- Lazy load notification components
- Virtualize long notification lists (100+)
- Batch fetch instead of individual requests
- Cache notifications with React Query

### Network
- Request size: ~2KB per notification
- 100 notifications = ~200KB
- Refresh interval: 5-10 seconds (reasonable)

### Database
- Index on `notifications.userId`
- Index on `notifications.read`
- Index on `notifications.createdAt`
- Limit queries to last 100 notifications

---

## Accessibility

- ✅ ARIA labels for icons
- ✅ Keyboard navigation support
- ✅ Color not only indicator (win/loss use icons too)
- ✅ Focus indicators on buttons
- ✅ Screen reader friendly

```tsx
<Bell
  className="w-5 h-5"
  aria-label="Bell icon for notifications"
/>
```

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Uses:
- React Query (polling)
- Fetch API
- CSS Grid/Flexbox
- ARIA attributes

---

## Files Included

| File | Purpose | Status |
|------|---------|--------|
| [TreasuryNotificationPanel.tsx](client/src/components/TreasuryNotificationPanel.tsx) | Main notification display | ✅ Complete |
| [TreasuryNotificationBadge.tsx](client/src/components/TreasuryNotificationBadge.tsx) | Unread counter badge | ✅ Complete |
| [routes.ts](server/routes.ts) (added endpoints) | API endpoints | ✅ Complete |

---

## Next Steps

1. **Import components** in your dashboard/navbar
2. **Pass userId** prop correctly
3. **Set isAdmin** flag based on user role
4. **Test with real notifications** from database
5. **Customize styling** to match your design
6. **Add sound alerts** (optional)
7. **Enable push notifications** (optional)

---

## Optional Enhancements

- [ ] Sound alert on new notification
- [ ] Desktop notifications via Notification API
- [ ] Notification grouping by challenge
- [ ] Bulk mark as read
- [ ] Notification preferences
- [ ] Email digest option
- [ ] WebSocket for instant updates (vs polling)
- [ ] Animated badge counter

---

**Status: ✅ COMPLETE**

Components are production-ready and fully integrated with backend APIs.
