import { PrivyClient } from '@privy-io/server-auth';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'cmc9a12oh01lnky0m1agzgdoc';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || 'HkeiV3uHt5F9uJhJGFjUSbsAFujpjTQFQGzhbMVa9X2aMFaeU3xuSBycAxogfLYM39jjeZVDyUTGv6zSMZ42YbR';

if (!process.env.PRIVY_APP_ID) {
  console.warn('⚠️ PRIVY_APP_ID not set in environment variables, using default');
}

if (!process.env.PRIVY_APP_SECRET) {
  console.warn('⚠️ PRIVY_APP_SECRET not set in environment variables, using default (ROTATE THIS SECRET!)');
}

export const privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

export async function verifyPrivyToken(token: string) {
  try {
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    return verifiedClaims;
  } catch (error) {
    console.error('Privy token verification failed:', error);
    return null;
  }
}

function getInitialsFromEmail(email?: string) {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0] || '';
  // split on non-alphanumeric characters
  const parts = local.split(/[^a-z0-9]+/i).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    const p = parts[0];
    return p.slice(0, 2).toUpperCase();
  }
  return '';
}

import { storage } from './storage';

async function getUserFromDb(userId: string) {
  try {
    // Fetch user from actual database
    const user = await storage.getUser(userId);
    return user;
  } catch (error) {
    console.error('Error fetching user from database:', error);
    return null;
  }
}

async function upsertPrivyUser(verifiedClaims: any) {
  try {
    const userId = verifiedClaims.userId || verifiedClaims.sub;
    let dbUser = await getUserFromDb(userId);
    
    console.log(`🔍 Processing user ${userId}, existing user: ${!!dbUser}`);
    if (dbUser) {
      console.log(`🔍 Existing user details: username=${dbUser.username}, email=${dbUser.email}`);
    }
    
    // Check for wallet account even if user exists to ensure username is updated if it was previously a default one
    let walletAccount = verifiedClaims.linkedAccounts?.find((acc: any) => 
      acc.type === 'wallet' || 
      (acc.type === 'custom_auth' && acc.custom_auth?.provider === 'wallet') ||
      (acc.address && /^0x[a-fA-F0-9]{40}$/.test(acc.address))
    );
    
    // Also check for any account with an address field
    const anyAccountWithAddress = verifiedClaims.linkedAccounts?.find((acc: any) => 
      acc.address && typeof acc.address === 'string' && acc.address.startsWith('0x')
    );
    
    if (walletAccount?.address) {
      console.log(`🔑 Wallet account FOUND: ${walletAccount.address} (type: ${walletAccount.type})`);
    } else if (anyAccountWithAddress?.address) {
      console.log(`🔑 Alternative wallet account FOUND: ${anyAccountWithAddress.address} (type: ${anyAccountWithAddress.type})`);
      // Use this as the wallet account
      walletAccount = anyAccountWithAddress;
    } else {
      console.log(`ℹ️ No wallet account found in linkedAccounts`);
      console.log(`ℹ️ Full linkedAccounts:`, JSON.stringify(verifiedClaims.linkedAccounts, null, 2));
    }
    
    if (!dbUser) {
      const email = verifiedClaims.email || `${userId}@privy.user`;

      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return existingByEmail;
      }

      let username: string;
      if (walletAccount?.address && /^0x[a-fA-F0-9]{40}$/.test(walletAccount.address)) {
        // Truncate wallet address for display as username - only for valid Ethereum addresses
        username = `${walletAccount.address.slice(0, 6)}...${walletAccount.address.slice(-4)}`;
        console.log(`👤 Setting username to real truncated wallet address: ${username} (from ${walletAccount.address})`);
      } else {
        username = verifiedClaims.email?.split('@')[0] || `user_${userId.slice(-8)}`;
        if (walletAccount?.address && !/^0x[a-fA-F0-9]{40}$/.test(walletAccount.address)) {
          console.warn(`⚠️ Not using invalid wallet address format for username: ${walletAccount.address}`);
        }
      }

      const fallbackFirstName = getInitialsFromEmail(verifiedClaims.email) || 'User';

      dbUser = await storage.upsertUser({
        id: userId,
        email: email,
        password: 'PRIVY_AUTH_USER',
        firstName: verifiedClaims.given_name || verifiedClaims.name || fallbackFirstName,
        lastName: verifiedClaims.family_name || 'User',
        username: username,
        profileImageUrl: verifiedClaims.picture,
      });
    } else if (walletAccount?.address && dbUser.username.startsWith('user_') && /^0x[a-fA-F0-9]{40}$/.test(walletAccount.address)) {
      // If user exists but has a default username and is now connecting a wallet, update it
      const truncatedAddress = `${walletAccount.address.slice(0, 6)}...${walletAccount.address.slice(-4)}`;
      console.log(`🔄 UPDATING USERNAME: Conditions met - walletAccount exists: ${!!walletAccount}, address: ${walletAccount?.address}, username starts with user_: ${dbUser.username.startsWith('user_')}, valid format: ${/^0x[a-fA-F0-9]{40}$/.test(walletAccount.address)}`);
      console.log(`🔄 Updating username from ${dbUser.username} to real truncated wallet address: ${truncatedAddress} (from ${walletAccount.address})`);
      
      try {
        dbUser = await storage.updateUserProfile(userId, {
          username: truncatedAddress
        });
        console.log(`🔄 Successfully updated username to truncated wallet address for user ${userId}`);
        console.log(`🔄 New user object:`, { id: dbUser.id, username: dbUser.username, email: dbUser.email });
      } catch (updateError) {
        console.error(`❌ Failed to update username for user ${userId}:`, updateError);
      }
    } else {
      console.log(`❌ NOT UPDATING USERNAME: Conditions not met`);
      console.log(`❌ walletAccount exists: ${!!walletAccount}`);
      console.log(`❌ walletAccount address: ${walletAccount?.address}`);
      console.log(`❌ dbUser username: ${dbUser?.username}`);
      console.log(`❌ username starts with user_: ${dbUser?.username?.startsWith('user_')}`);
      console.log(`❌ valid format: ${walletAccount?.address ? /^0x[a-fA-F0-9]{40}$/.test(walletAccount.address) : 'N/A'}`);
    }
    
    // Extract Telegram data from Privy linkedAccounts if user signed in with Telegram
    if (verifiedClaims.linkedAccounts) {
      const telegramAccount = verifiedClaims.linkedAccounts.find((account: any) => account.type === 'telegram');
      if (telegramAccount && telegramAccount.telegramUserId) {
        console.log(`🔗 Telegram account detected in Privy claims: ${telegramAccount.telegramUserId}`);
        
        // Update user with Telegram ID if not already set
        if (!dbUser.telegramId) {
          dbUser = await storage.updateUserTelegramInfo(userId, {
            telegramId: telegramAccount.telegramUserId.toString(),
            telegramUsername: telegramAccount.telegramUsername || `tg_${telegramAccount.telegramUserId}`,
            isTelegramUser: true,
          });
          console.log(`✅ User ${userId} linked with Telegram ID ${telegramAccount.telegramUserId}`);
        }
      }
    }
    
    return dbUser;
  } catch (error) {
    console.error('Error upserting Privy user:', error);
    throw error;
  }
}

export async function PrivyAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  // Allow Passport session as fallback if no Privy token provided
  if (!authHeader && req.isAuthenticated && req.isAuthenticated()) {
    // If a session is active, attach the user cartaints (existing user object) and proceed
    try {
      const sessionUser = req.user;
      if (sessionUser) {
        req.user = sessionUser;
        return next();
      }
    } catch (err) {
      console.error('Error using session-based auth fallback:', err);
      // fallthrough to token-based verification
    }
  }

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifiedClaims = await verifyPrivyToken(token);

    const userId = verifiedClaims?.userId || verifiedClaims?.sub;
    if (!verifiedClaims || !userId) {
      return res.status(401).json({ message: 'Invalid token or user ID not found' });
    }

    const dbUser = await upsertPrivyUser(verifiedClaims);

    if (!dbUser) {
      return res.status(500).json({ message: 'Failed to create or retrieve user' });
    }

    // Attach user to request with proper structure for routes
    // Privy auth structure - set both id and claims for compatibility
    req.user = {
      id: dbUser.id,
      email: dbUser.email || '',
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      username: dbUser.username,
      isAdmin: dbUser.isAdmin || false,
      claims: {
        sub: dbUser.id,
        email: dbUser.email,
        first_name: dbUser.firstName,
        last_name: dbUser.lastName,
      }
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
}