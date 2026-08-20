// Firebase Cloud Messaging background handler (Phase 7, Centralized
// Result-Announcement Notifications plan). Separate from the VitePWA-generated
// service worker (vite.config.ts) -- Workbox's `generateSW` strategy doesn't
// expose a hook for custom `push` events, so this is a second, independently
// registered SW at a fixed root path, per Firebase's standard web-push setup.
// It only handles background/terminated-tab delivery; foreground delivery
// (tab open) is handled by `onMessage` in src/config/messaging.ts.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// `public/` isn't processed by Vite, so this can't read `import.meta.env` --
// these are the same public Firebase web-app config values as `.env`
// (VITE_FIREBASE_*), which are not secrets (Firebase's web config is safe to
// expose; access control is enforced by firestore.rules, not by hiding this).
// This key is also already exposed in the React app bundle.
firebase.initializeApp({
  // nocommit: Firebase public web config, not a secret (access control via firestore.rules)
  apiKey: 'AIzaSyB-_l_cXq_K-y2xsW7Z5ty2zeWQcIBQGpc',
  authDomain: 'ssbmax-49e68.firebaseapp.com',
  projectId: 'ssbmax-49e68',
  storageBucket: 'ssbmax-49e68.firebasestorage.app',
  messagingSenderId: '836687498591',
  appId: '1:836687498591:web:8344203ceec988e5f3baea'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'SSBMax';
  const body = payload.notification?.body || payload.data?.message || '';
  const actionUrl = payload.data?.actionUrl || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { actionUrl }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || '/';
  event.waitUntil(clients.openWindow(actionUrl));
});
