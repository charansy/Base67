/**
 * Push Notification Utilities for Base67 PWA
 *
 * Handles FCM token management, permission requests, and
 * platform detection (iOS standalone check, notification support).
 */

import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, getMessagingInstance } from '../firebase';
import { hashUid } from './hashUid';

// ── VAPID Key ──────────────────────────────────────────────────────────────
// You must generate this in Firebase Console → Project Settings → Cloud Messaging
// → Web Push certificates → "Generate key pair"
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

// ── Platform Detection ─────────────────────────────────────────────────────

/** True if running as installed PWA on iOS (Home Screen mode) */
export const isIOSStandalone = (): boolean => {
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
};

/** True if running on any iOS device */
export const isIOS = (): boolean => {
  return /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/** True if running in Safari (not Chrome/Firefox on iOS, all use WebKit but this detects Safari shell) */
export const isIOSSafari = (): boolean => {
  return isIOS() && !isIOSStandalone();
};

/** Check if the browser supports push notifications */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/** Get current permission state */
export const getNotificationStatus = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

// ── Service Worker Registration ────────────────────────────────────────────

/** Register the Firebase Messaging Service Worker */
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('[Notifications] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[Notifications] Service Worker registration failed:', error);
    return null;
  }
};

// ── Token Management ───────────────────────────────────────────────────────

/** Save FCM token to Firestore under the user's hashed UID */
const saveTokenToFirestore = async (token: string): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const hashedUid = await hashUid(uid);

  // Detect platform
  let platform = 'web';
  if (isIOS()) platform = 'ios';
  else if (/Android/i.test(navigator.userAgent)) platform = 'android';

  await setDoc(doc(db, 'fcmTokens', hashedUid), {
    token,
    platform,
    updatedAt: serverTimestamp(),
  });

  console.log('[Notifications] Token saved to Firestore');
};

// ── Main Entry Point ───────────────────────────────────────────────────────

export interface NotificationResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Request notification permission, get FCM token, and save it.
 *
 * This must be called from a user gesture (button click) — especially on iOS.
 */
export const requestNotificationPermission = async (): Promise<NotificationResult> => {
  try {
    // 1. Check basic support
    if (!isNotificationSupported()) {
      return { success: false, error: 'Notifications not supported on this browser.' };
    }

    // 2. iOS standalone check
    if (isIOS() && !isIOSStandalone()) {
      return {
        success: false,
        error: 'On iOS, you must add Base67 to your Home Screen first.',
      };
    }

    // 3. Check VAPID key
    if (!VAPID_KEY) {
      console.error('[Notifications] VAPID_KEY is missing from environment variables.');
      return { success: false, error: 'Push notification configuration is incomplete.' };
    }

    // 4. Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied.' };
    }

    // 5. Register Service Worker
    const swRegistration = await registerServiceWorker();
    if (!swRegistration) {
      return { success: false, error: 'Service Worker registration failed.' };
    }

    // 6. Get FCM token
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, error: 'Firebase Messaging not supported.' };
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return { success: false, error: 'Failed to get notification token.' };
    }

    // 7. Save token to Firestore
    await saveTokenToFirestore(token);

    return { success: true, token };
  } catch (error: any) {
    console.error('[Notifications] Error:', error);
    return { success: false, error: error.message || 'Unknown error.' };
  }
};

/**
 * Set up foreground message handler — shows an in-app toast when
 * a notification arrives while the user has the app open.
 */
export const setupForegroundListener = async (
  onNotification: (title: string, body: string) => void
): Promise<void> => {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log('[Notifications] Foreground message:', payload);
    const title = payload.notification?.title || '🔥 Buzzin\' on Base67';
    const body = payload.notification?.body || 'A post is blowing up!';
    onNotification(title, body);
  });
};
