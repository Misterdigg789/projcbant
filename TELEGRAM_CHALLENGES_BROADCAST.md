# Telegram Challenges Broadcast Implementation

## Overview
Both admin-created challenges and P2P (peer-to-peer) challenges are now automatically posted to the Telegram channel/group when they are created.

## Features Implemented

### 1. **P2P Challenge Broadcasting** ✅
- **Location**: [server/routes.ts#L1588](server/routes.ts#L1588)
- **Endpoint**: `POST /api/challenges`
- **Trigger**: When a user creates a challenge against another user
- **What's Included**:
  - Challenge title and description
  - Challenger and challenged user names/usernames
  - Stake amount
  - Category
  - Due date/time
  - Direct link to challenge on the web app
- **Additional Feature**: If the challenged user has Telegram linked, they receive a direct "Accept Challenge" card

### 2. **Admin Challenge Broadcasting** ✅
- **Location**: [server/routes.ts#L3947](server/routes.ts#L3947)
- **Endpoint**: `POST /api/admin/challenges`
- **Trigger**: When an admin creates a new public challenge
- **What's Included**:
  - Challenge title and description
  - Admin name/username
  - Stake amount
  - Status (open)
  - Category
  - Due date (if set)
  - Direct link to challenge on the web app

## Message Format

Both challenge types use the `formatChallengeMessage()` function to create rich, formatted Telegram messages:

```
⚔️ *NEW P2P CHALLENGE*

━━━━━━━━━━━━━━━━━━━━━
🎮 *Challenge Title*
━━━━━━━━━━━━━━━━━━━━━

💭 Challenge description here
🚀 *Challenger:* @username1
🎯 *Challenged:* @username2
💰 *Stake Amount:* ₦5,000
🔥 *Status:* Active
🎮 *Category:* Gaming

⏰ *2d 5h remaining to accept*

━━━━━━━━━━━━━━━━━━━━━
🎯 [*VIEW CHALLENGE*](https://app.url/challenges/123)
━━━━━━━━━━━━━━━━━━━━━

#BetChat #Challenge #P2P #Gaming
```

## Services & Classes

### TelegramBotService
**File**: [server/telegramBot.ts](server/telegramBot.ts)

#### Key Methods:

**`broadcastChallenge(challenge: ChallengeBroadcast): Promise<boolean>`** (Line 517)
- Formats and sends challenge message to Telegram channel
- Handles errors gracefully without blocking main process
- Returns success/failure boolean

**`formatChallengeMessage(challenge: ChallengeBroadcast): string`** (Line 272)
- Converts challenge data into formatted Telegram markdown
- Includes category emoji, stake details, time remaining
- Generates deep link to challenge in web app

**`sendChallengeAcceptCard(chatId: number, challenge: any): Promise<boolean>`** 
- Sends inline keyboard with direct "Accept" button to challenged user
- Only triggered if user has Telegram linked via telegramId
- Allows instant challenge acceptance from Telegram

#### Interface: ChallengeBroadcast

```typescript
interface ChallengeBroadcast {
  id: string | number;
  title: string;
  description?: string;
  creator: {
    name: string;
    username?: string;
  };
  challenged?: {
    name: string;
    username?: string;
  };
  stake_amount: number;
  status: string;
  end_time?: string;
  category?: string;
}
```

## Integration Points

### 1. P2P Challenge Creation Route
**File**: [server/routes.ts#L1588](server/routes.ts#L1588)

```typescript
const telegramBot = getTelegramBot();
if (telegramBot && challenger && challenged) {
  try {
    await telegramBot.broadcastChallenge({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description || undefined,
      creator: { /* challenger info */ },
      challenged: { /* challenged info */ },
      stake_amount: parseFloat(challenge.amount),
      status: challenge.status,
      end_time: challenge.dueDate,
      category: challenge.type,
    });
    console.log("📤 Challenge broadcasted to Telegram successfully");
    
    // Send accept card to challenged user if they have Telegram
    if (challenged.telegramId) {
      await telegramBot.sendChallengeAcceptCard(
        parseInt(challenged.telegramId),
        { /* challenge data */ }
      );
    }
  } catch (error) {
    console.error("❌ Failed to broadcast challenge to Telegram:", error);
  }
}
```

### 2. Admin Challenge Creation Route
**File**: [server/routes.ts#L3947](server/routes.ts#L3947)

```typescript
const telegramBot = getTelegramBot();
if (telegramBot) {
  try {
    const admin = await storage.getUser((req as any).user?.id);
    await telegramBot.broadcastChallenge({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description || undefined,
      creator: {
        name: admin?.firstName || admin?.username || 'Admin',
        username: admin?.username || undefined,
      },
      stake_amount: parseFloat(String(challenge.amount || '0')),
      status: challenge.status,
      end_time: challenge.dueDate,
      category: category,
    });
    console.log("📤 Admin challenge broadcasted to Telegram successfully");
  } catch (error) {
    console.error("❌ Failed to broadcast admin challenge to Telegram:", error);
  }
}
```

## Error Handling

- **Non-blocking**: Telegram broadcast failures don't prevent challenge creation
- **Logging**: All errors are logged for monitoring
- **Graceful degradation**: If Telegram bot is not configured, feature is silently skipped
- **User feedback**: HTTP response is sent before Telegram broadcast completes

## Environment Requirements

For Telegram broadcasting to work:

1. **Bot Token**: `TELEGRAM_BOT_TOKEN` environment variable set
2. **Channel ID**: `TELEGRAM_CHANNEL_ID` environment variable set
3. **Frontend URL**: `FRONTEND_URL` or `REPLIT_DOMAINS` for deep links

## Future Enhancements

- [ ] Post challenge results to Telegram
- [ ] Post challenge cancellations to Telegram
- [ ] Post bonus activations to Telegram
- [ ] Allow inline Telegram commands to accept challenges
- [ ] Post leaderboard updates to Telegram
- [ ] Direct message notifications for challenge outcomes

## Testing

To test Telegram broadcasting:

1. **Admin Challenge**:
   ```bash
   curl -X POST http://localhost:5000/api/admin/challenges \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Admin Challenge",
       "description": "A test challenge",
       "category": "gaming",
       "amount": 1000
     }'
   ```

2. **P2P Challenge**:
   ```bash
   curl -X POST http://localhost:5000/api/challenges \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Challenge",
       "description": "Challenge you",
       "type": "gaming",
       "amount": "500",
       "challenged": "user-id-here",
       "dueDate": "2025-12-31T23:59:59Z"
     }'
   ```

3. **Verify Telegram**: Check your Telegram channel/group to see the posted challenge message

## Console Output

When broadcasting is successful, you'll see:
```
📤 Challenge broadcasted to Telegram successfully
```

When it fails:
```
❌ Failed to broadcast challenge to Telegram: [error message]
```

## Related Files

- [server/telegramBot.ts](server/telegramBot.ts) - Telegram service implementation
- [server/routes.ts](server/routes.ts) - API endpoints
- [server/storage.ts](server/storage.ts) - Challenge creation logic
- [TELEGRAM_CHALLENGES_BROADCAST.md](TELEGRAM_CHALLENGES_BROADCAST.md) - This document
