importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyC0s...", // Will be replaced with actual key at runtime
  authDomain: "bantah-app.firebaseapp.com",
  projectId: "bantah-app",
  storageBucket: "bantah-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Bantah Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/assets/bantahblue.svg',
    badge: '/assets/bantahblue.svg',
    tag: payload.data?.challengeId || payload.data?.eventId || 'notification',
    requireInteraction: payload.data?.priority === 'HIGH',
    data: payload.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw] Notification clicked:', event.notification);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Check if there's already a window open with the target URL
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw] Notification closed:', event.notification);
});
