import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// ==========================================
// SHARED POST PREVIEW — Unauthenticated Landing
// ==========================================
// Shows a truncated version of a single post with a CTA to log in.
// Accessed via /#/post/<postId> when the user is not authenticated.

interface SharedPostPreviewProps {
    postId: string;
}

export default function SharedPostPreview({ postId }: SharedPostPreviewProps) {
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const snap = await getDoc(doc(db, 'posts', postId));
                if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
            } catch (err) {
                console.error('Failed to fetch shared post:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [postId]);

    const handleLogin = () => {
        // Clear the hash so they land on the main page after login
        window.location.hash = '';
        window.location.reload();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#7f00ff] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Truncate text to ~half
    const fullText = post?.text || '';
    const halfLength = Math.max(40, Math.ceil(fullText.length / 2));
    const truncated = fullText.length > halfLength
        ? fullText.slice(0, halfLength) + '…'
        : fullText;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex flex-col">
            {/* Header */}
            <nav className="border-b border-zinc-900 px-4 py-3 flex items-center gap-2">
                <img src="/logo.png" alt="Base67 logo" className="w-7 h-7 object-contain" />
                <h1 className="font-bold tracking-tight" style={{ fontSize: '27px' }}>
                    Base<span style={{ color: '#7f00ff' }}>67</span>
                </h1>
            </nav>

            {/* Post Preview */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                {post ? (
                    <div className="w-full max-w-md">
                        {/* The post card */}
                        <div className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl mb-6 relative overflow-hidden">
                            {/* Author line */}
                            <div className="text-xs text-zinc-500 mb-3 flex items-center gap-2">
                                <span className="font-medium text-zinc-300">Anonymous</span>
                                <span>•</span>
                                <span>Shared post</span>
                            </div>

                            {/* Truncated text */}
                            <p className="text-[15px] leading-relaxed text-zinc-100 whitespace-pre-wrap">
                                {truncated}
                            </p>

                            {/* Image preview (blurred) */}
                            {post.imageUrl && (
                                <div className="mt-4 rounded-xl overflow-hidden border border-zinc-800/50 relative">
                                    <img
                                        src={post.imageUrl}
                                        alt="Post attachment"
                                        className="w-full h-auto object-cover max-h-48 blur-md scale-105"
                                    />
                                    <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center">
                                        <span className="text-xs text-zinc-400 font-medium">Log in to view</span>
                                    </div>
                                </div>
                            )}

                            {/* Poll preview */}
                            {post.pollOptions && (
                                <div className="mt-4 space-y-2">
                                    {post.pollOptions.slice(0, 2).map((opt: string, i: number) => (
                                        <div key={i} className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl px-4 py-3">
                                            <span className="text-sm text-zinc-400">{opt}</span>
                                        </div>
                                    ))}
                                    {post.pollOptions.length > 2 && (
                                        <p className="text-xs text-zinc-600 text-center">+{post.pollOptions.length - 2} more options</p>
                                    )}
                                </div>
                            )}

                            {/* Gradient fade over the bottom */}
                            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
                        </div>

                        {/* CTA */}
                        <div className="text-center space-y-4">
                            <p className="text-zinc-400 text-sm">
                                This post was shared from <strong className="text-zinc-200">Base67</strong> — the anonymous feed for IIT Dharwad.
                            </p>

                            <button
                                onClick={handleLogin}
                                className="w-full flex justify-center items-center gap-3 py-4 px-4 rounded-2xl text-base font-semibold !bg-white !text-black hover:!bg-zinc-100 transition-all"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Verify Institute Email
                            </button>

                            <p className="text-[11px] text-zinc-600">
                                Only @iitdh.ac.in emails. Your identity stays completely anonymous.
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Post not found */
                    <div className="text-center space-y-4">
                        <p className="text-zinc-400 text-lg">Post not found</p>
                        <button onClick={handleLogin} className="text-[#7f00ff] text-sm font-medium hover:underline">
                            Go to Base67 →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
