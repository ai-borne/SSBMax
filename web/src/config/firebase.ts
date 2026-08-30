import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, disableNetwork, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ssbmax-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ssbmax-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ssbmax-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with local IndexedDB persistent cache and multi-tab manager
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch {
  // If already initialized (e.g. during re-renders or hot module reloads)
  db = getFirestore(app);
}

// E2E (Playwright) always runs against the 'ssbmax-demo' placeholder project (CI sets no
// VITE_FIREBASE_PROJECT_ID) -- reads against it hit real Firestore, which retries/backs off
// on the resulting permission-denied for many seconds before ContentRepository's DEV-mode
// fallback kicks in. Killing the network up front makes every read miss the empty local
// cache immediately, so the fallback resolves in milliseconds instead of racing gRPC backoff.
if (import.meta.env.VITE_E2E === 'true') {
  disableNetwork(db).catch(() => {});
}

const auth = getAuth(app);
const functions = getFunctions(app);

export { app, db, auth, functions };
