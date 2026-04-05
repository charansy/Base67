import Feed from './components/Feed';
import Acad from './components/Acad';
import SharedPostPreview from './components/SharedPostPreview';
import NotificationBanner from './components/NotificationBanner';
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './components/login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<'feed' | 'acad'>('feed');

  // Parse hash route for shared post deep links
  const getSharedPostId = (): string | null => {
    const hash = window.location.hash;
    const match = hash.match(/^#\/post\/(.+)$/);
    return match ? match[1] : null;
  };

  const [sharedPostId, setSharedPostId] = useState<string | null>(getSharedPostId());

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => setSharedPostId(getSharedPostId());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // This is the Firebase magic that remembers if a user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      setUser(currentUser);
      setLoading(false);
      // If user just logged in and was on a shared post, clear the hash so they go to the feed
      if (currentUser && window.location.hash.startsWith('#/post/')) {
        window.location.hash = '';
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ── Unauthenticated visitor on a shared post link ──────────────────
  if (!user && sharedPostId) {
    return <SharedPostPreview postId={sharedPostId} />;
  }

  return (
    <div className={`min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 ${user ? 'pb-16' : ''}`}>
      {user ? (
        <>
          <NotificationBanner />
          {activePage === 'feed' ? (
            <Feed />
          ) : (
            <Acad />
          )}

          {/* Fixed Bottom Navigation Bar — YouTube proportions */}
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-900 z-50">
            <div className="flex w-full">
              <button
                onClick={() => setActivePage('feed')}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors border-0 !bg-transparent outline-none focus:outline-none ${activePage === 'feed' ? 'text-white' : 'text-zinc-500'
                  }`}
              >
                {/* Flame / Feed icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6" fill={activePage === 'feed' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activePage === 'feed' ? 0 : 1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
                </svg>
                <span className="text-[10px] font-medium">Feed</span>
              </button>
              <button
                onClick={() => setActivePage('acad')}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors border-0 !bg-transparent outline-none focus:outline-none ${activePage === 'acad' ? 'text-white' : 'text-zinc-500'
                  }`}
              >
                {/* Academics/mortarboard icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6" fill={activePage === 'acad' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activePage === 'acad' ? 0 : 1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
                <span className="text-[10px] font-medium">Acad</span>
              </button>
            </div>
          </div>

        </>
      ) : (
        /* The Gatekeeper Screen */
        <Login />
      )}
    </div>
  );
}

export default App;
