/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This runs in the background to receive push notifications even when the app is closed.

importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBYI0IGjiHxSPfI08oCugcscnJ9hUWGCvU',
  authDomain: 'base-67.firebaseapp.com',
  projectId: 'base-67',
  storageBucket: 'base-67.firebasestorage.app',
  messagingSenderId: '1067356175034',
  appId: '1:1067356175034:web:4027405e851224eab46083',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || '🔥 Buzzin\' on Base67', {
    body: body || 'A post is blowing up right now!',
    icon: icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.data?.postId || 'buzz-notification',
    data: {
      url: payload.data?.url || '/',
      postId: payload.data?.postId || '',
    },
    // Vibration pattern — short, long, short
    vibrate: [100, 300, 100],
    actions: [
      { action: 'open', title: 'View Post' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  });
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      return clients.openWindow(targetUrl);
    })
  );
});
