import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Share, Plus } from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationStatus,
  isIOS,
  isIOSStandalone,
  isNotificationSupported,
  setupForegroundListener,
} from '../utils/notifications';

/**
 * NotificationBanner — context-aware notification opt-in component.
 *
 * States:
 *   1. Not supported → hidden
 *   2. iOS Safari (not installed as PWA) → shows install instructions
 *   3. Permission = 'default' → shows enable button
 *   4. Permission = 'granted' → hidden (already enabled)
 *   5. Permission = 'denied' → shows subtle "blocked" hint
 */
export default function NotificationBanner() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported' | 'ios-safari'>('default');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    // Check if user previously dismissed
    if (localStorage.getItem('b67-notif-dismissed') === 'true') {
      setDismissed(true);
    }

    // Determine current state
    if (isIOS() && !isIOSStandalone()) {
      setStatus('ios-safari');
    } else if (!isNotificationSupported()) {
      setStatus('unsupported');
    } else {
      setStatus(Notification.permission);
    }

    // Set up foreground listener for in-app toasts
    setupForegroundListener((title, body) => {
      setToastMessage({ title, body });
      setTimeout(() => setToastMessage(null), 5000);
    });
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setResultMsg('');

    const result = await requestNotificationPermission();

    if (result.success) {
      setStatus('granted');
      setResultMsg('🔥 Notifications enabled!');
      setTimeout(() => setResultMsg(''), 3000);
    } else {
      setStatus(getNotificationStatus());
      setResultMsg(result.error || 'Something went wrong.');
      setTimeout(() => setResultMsg(''), 5000);
    }

    setLoading(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('b67-notif-dismissed', 'true');
  };

  // ── Foreground toast notification ──────────────────────────────────
  const toast = toastMessage && (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-3 fade-in duration-300">
      <div className="bg-indigo-600 border border-indigo-500 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{toastMessage.title}</p>
            <p className="text-xs text-indigo-200 mt-0.5">{toastMessage.body}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-indigo-300 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Don't render if not needed ─────────────────────────────────────
  if (status === 'unsupported' || status === 'granted' || dismissed) {
    return <>{toast}</>;
  }

  // ── iOS Safari: Show "Add to Home Screen" instructions ─────────────
  if (status === 'ios-safari') {
    return (
      <>
        {toast}
        <div className="mx-4 mt-3 mb-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Get Buzzin' Alerts</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                To enable notifications on iPhone:
              </p>
              <ol className="text-xs text-zinc-400 mt-2 space-y-1.5 list-none">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-md flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">1</span>
                  <span>Tap the <Share className="w-3.5 h-3.5 inline text-indigo-400 -mt-0.5" /> share button</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-md flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">2</span>
                  <span>Tap <span className="text-zinc-200 font-medium">"Add to Home Screen"</span> <Plus className="w-3.5 h-3.5 inline text-indigo-400 -mt-0.5" /></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-zinc-800 rounded-md flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">3</span>
                  <span>Open Base67 from the icon & enable notifications</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Permission denied ──────────────────────────────────────────────
  if (status === 'denied') {
    return (
      <>
        {toast}
        <div className="mx-4 mt-3 mb-1 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-3 flex items-center gap-3">
          <BellOff className="w-4 h-4 text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-500 flex-1">
            Notifications blocked. Go to Settings → Base67 → Allow Notifications.
          </p>
          <button onClick={handleDismiss} className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </>
    );
  }

  // ── Default: prompt to enable ──────────────────────────────────────
  return (
    <>
      {toast}
      <div className="mx-4 mt-3 mb-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">Never miss a Buzzin' post</p>
            <p className="text-xs text-zinc-400 mt-0.5">Get alerts when posts blow up 🔥</p>
          </div>
        </div>

        <button
          onClick={handleEnable}
          disabled={loading}
          className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enabling...
            </span>
          ) : (
            'Enable Notifications'
          )}
        </button>

        {resultMsg && (
          <p className={`text-xs mt-2 text-center ${resultMsg.includes('🔥') ? 'text-green-400' : 'text-red-400'}`}>
            {resultMsg}
          </p>
        )}
      </div>
    </>
  );
}
