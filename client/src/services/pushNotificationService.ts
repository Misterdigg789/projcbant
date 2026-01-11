/**
 * Push Notification Service (Client-side)
 * Firebase Cloud Messaging setup for browser push notifications
 */

/**
 * Initialize Firebase Cloud Messaging
 * Call this on app startup (client-side only)
 */
export async function initializeFCM() {
  if (typeof window === 'undefined') return;

  try {
    // Check if Firebase is available
    const firebase = (window as any).firebase;
    if (!firebase) {
      console.log('ℹ️  Firebase not available, push notifications disabled');
      return;
    }

    const messaging = firebase.messaging();

    // Request permission and get token
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await messaging.getToken({
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
          // Store token on server
          await saveFCMToken(token);
          console.log('✅ FCM initialized, token saved');
        }
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
    }

    // Listen for messages when app is in foreground
    messaging.onMessage((payload: any) => {
      console.log('📬 Message received:', payload);
      
      // Show notification or update UI
      if (payload.notification) {
        new Notification(payload.notification.title || 'Notification', {
          body: payload.notification.body,
          icon: payload.notification.image,
        });
      }
    });
  } catch (error) {
    console.error('FCM initialization failed:', error);
  }
}

/**
 * Save FCM token to server
 */
async function saveFCMToken(token: string) {
  try {
    const response = await fetch('/api/user/fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      console.error('Failed to save FCM token');
    }
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}
