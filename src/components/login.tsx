import React, { useState } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { AlertCircle, Loader2, GraduationCap } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    const provider = new GoogleAuthProvider();

    // The Front-End Gatekeeper: Forces the Google popup to only show/accept IIT Dharwad emails
    provider.setCustomParameters({
      hd: 'iitdh.ac.in'
    });

    try {
      const result = await signInWithPopup(auth, provider);

      // The Back-End Gatekeeper: Double checks the email just to be absolutely secure
      if (!result.user.email?.endsWith('@iitdh.ac.in')) {
        await signOut(auth); // Instantly kick them out
        setError('Access denied. Only IIT Dharwad student emails are allowed.');
      }
      // If it matches, App.jsx's onAuthStateChanged will automatically catch it and let them in!

    } catch (err: any) {
      // Ignore the error if the user just closed the popup window manually
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col justify-center px-6 py-12 selection:bg-indigo-500/30">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">

        {/* Header */}
        <div className="mb-6 flex items-center justify-center">
          <img src="/logo.png" alt="Base67 logo" className="w-20 h-20 object-contain drop-shadow-lg" />
        </div>
        <div className="mb-10 text-center">
          <h1 className="text-xl font-bold tracking-tight mb-2">Base<span style={{ color: '#7f00ff' }}>67</span></h1>
          <p className="text-zinc-400 text-sm max-w-xs mx-auto space-y-3">
            <span className="block font-medium text-zinc-300">IIT Dharwad, Unfiltered.</span>
            <span className="block leading-relaxed">
              IIT Dharwad incognito: The 67% of campus life that Instagram will never see..
            </span>
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex justify-center items-center gap-3 py-4 px-4 rounded-2xl text-base font-semibold bg-white text-zinc-900 !bg-white !text-black hover:!bg-zinc-100 active:!bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Verify Institute Email
            </>
          )}
        </button>

        <p className="mt-6 text-xs text-zinc-500 text-center max-w-xs">
          Your identity is completely hidden when you post. We only use your email to verify you belong to the campus.
        </p>
      </div>
    </div>
  );
}