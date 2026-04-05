import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, where, limit, getDocs, onSnapshot, serverTimestamp, doc, updateDoc, increment, arrayUnion, arrayRemove, Timestamp, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { hashUid } from '../utils/hashUid';
import {
  ArrowBigUp, ArrowBigDown, MessageSquare, Flame,
  User, Send, CornerDownRight, Mic, Sparkles, BookOpen,
  BarChart2, X, Plus, Trash2, ImageIcon, LogOut, Loader2,
  Share2, Copy, Check
} from 'lucide-react';
import { checkAndNotifyBuzz } from '../utils/buzzNotifier';

// ==========================================
// BUZZIN' VELOCITY SCORER
// ==========================================
const getBuzzScore = (post: any): number => {
  const now = Date.now();
  const created = post.createdAt?.toDate?.()?.getTime() ?? now;
  const ageMinutes = Math.max(1, (now - created) / 60000);
  const engagement = (post.upvoteCount || 0) + (post.commentCount || 0) * 2;
  return engagement / ageMinutes;
};

// ==========================================
// THE ALIAS GENERATOR
// ==========================================
const generateAlias = (uid: string, postId: string) => {
  const adjectives = ['Quantum', 'Neon', 'Cosmic', 'Lunar', 'Solar', 'Plasma', 'Cyber', 'Astro'];
  const nouns = ['Eagle', 'Tiger', 'Fox', 'Bear', 'Wolf', 'Falcon', 'Owl', 'Shark'];

  const hashString = uid + postId;
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    hash = hashString.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const adj = adjectives[hash % adjectives.length];
  const noun = nouns[hash % nouns.length];

  return `${adj} ${noun}`;
};

// ==========================================
// TIME FORMATTER
// ==========================================
const timeAgo = (date: any) => {
  if (!date) return '';
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo';
  interval = seconds / 604800;
  if (interval > 1) return Math.floor(interval) + 'w';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm';
  return 'just now';
};

// ==========================================
// LAZY COMMENT GENERATOR
// ==========================================
const COMMENT_LOGIC = [
  {
    keywords: ['midsem', 'cpi', 'exam', 'quiz', 'assignment', 'grade', 'fail', 'ep201', 'physics'],
    replies: ['CPI in shambles.', 'Cooked.', 'Academic comeback needed.', 'Drop out.', 'Average EP major.']
  },
  {
    keywords: ['startup', 'founder', 'saas', 'pitch', 'funding', 'vc', 'placement', 'job'],
    replies: ['Bro is cooking.', 'VCs are shaking.', 'Let him pitch.', 'Day 1 placement energy.']
  },
  {
    keywords: ['commode', 'toilet', 'plumbing', 'hostel', 'mess', 'food', 'wifi', 'infrastructure'],
    replies: ['What the helllll.', 'Admin is ruthless.', 'Civil engineering in shambles.', 'Survival of the fittest.']
  },
  {
    keywords: ['fire', 'forest', 'smoke', 'isha', 'yoga', 'peace'],
    replies: ['Apocalyptic vibe.', 'Let it burn.', 'Chakras aligned.', 'Real.']
  }
];

const FALLBACK_REPLIES = ['Real.', 'Skill issue.', 'Big if true.', 'Jail.', 'Absolute cinema.'];

const getContextualReplies = (postText: string) => {
  const text = (postText || '').toLowerCase();
  let matchedReplies: string[] = [];

  COMMENT_LOGIC.forEach(category => {
    const hasKeyword = category.keywords.some(word => text.includes(word));
    if (hasKeyword) {
      matchedReplies = [...matchedReplies, ...category.replies];
    }
  });

  const pool = matchedReplies.length > 0 ? matchedReplies : FALLBACK_REPLIES;
  const shuffled = [...new Set(pool)].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// ==========================================
// COMMENT TREE HELPER & NODE COMPONENT
// ==========================================
const buildCommentTree = (flatComments: any[]) => {
  const commentMap = new Map<string, any>();
  const rootComments: any[] = [];

  flatComments.forEach(c => {
    commentMap.set(c.id, { ...c, children: [] });
  });

  flatComments.forEach(c => {
    const node = commentMap.get(c.id);
    if (!node) return;

    if (c.parentId) {
      const parent = commentMap.get(c.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        rootComments.push(node);
      }
    } else {
      rootComments.push(node);
    }
  });

  return rootComments;
};

function CommentNode({ 
  comment, 
  post, 
  submitText, 
  depth = 0 
}: { 
  comment: any, 
  post: any, 
  submitText: (text: string, parentId?: string | null) => Promise<void>,
  depth?: number 
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOP = comment.authorUid === post.authorUid && post.authorUid !== undefined;
  
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await submitText(replyText, comment.id);
    setReplyText('');
    setIsReplying(false);
    setIsSubmitting(false);
  };

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className={`relative ${depth === 0 ? 'mt-5' : ''}`}>
      <div className={`group ${isCollapsed ? 'opacity-70' : ''}`}>
        <div className="text-[11px] text-zinc-500 mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={toggleCollapse}>
            <span className="font-semibold text-zinc-300 hover:underline">
              {isOP ? 'Anonymous' : generateAlias(comment.authorUid, post.id)}
            </span>
            {isOP && (
              <span className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-1 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase">
                <Mic className="w-2.5 h-2.5" /> OP
              </span>
            )}
            <span>•</span>
            <span>{timeAgo(comment.createdAt?.toDate())}</span>
          </div>
          {comment.children?.length > 0 && (
            <button onClick={toggleCollapse} className="text-[10px] text-zinc-500 hover:text-zinc-300 font-medium">
              {isCollapsed ? `Show ${comment.children.length} replies` : 'Hide replies'}
            </button>
          )}
        </div>
        
        {!isCollapsed && (
          <>
            <p className="text-[13px] text-zinc-100 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
            
            <div className="mt-1.5 flex items-center gap-4">
              {/* Upvote / Downvote (Visual only right now since comment votes aren't in Firebase) */}
              <div className="flex items-center gap-1">
                <button className="text-zinc-500 hover:text-indigo-400 transition-colors p-1 -ml-1">
                  <ArrowBigUp className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold text-zinc-400">{comment.upvoteCount || 0}</span>
                <button className="text-zinc-500 hover:text-red-400 transition-colors p-1">
                  <ArrowBigDown className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={() => setIsReplying(!isReplying)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 font-bold transition-colors"
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            </div>
            
            {isReplying && (
              <form onSubmit={handleReplySubmit} className="mt-2 mb-2 relative flex items-center max-w-sm">
                 <input
                   type="text"
                   value={replyText}
                   onChange={(e) => setReplyText(e.target.value)}
                   placeholder="Add a reply..."
                   className="w-full bg-transparent border-b border-zinc-700 py-1.5 pr-8 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-all rounded-none"
                   maxLength={200}
                   autoFocus
                 />
                 <button
                   type="submit"
                   disabled={isSubmitting || !replyText.trim()}
                   className="absolute right-0 p-1 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-transparent border-0"
                 >
                   {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                 </button>
              </form>
            )}
          </>
        )}
      </div>
      
      {!isCollapsed && comment.children?.length > 0 && (
        <div className="relative mt-2">
          {comment.children.map((child: any, index: number) => {
            const isLast = index === comment.children.length - 1;
            return (
              <div key={child.id} className="relative pl-4 md:pl-5">
                {/* L-shaped line pointing to the child */}
                <div 
                  className="absolute left-0 top-0 w-3 md:w-3.5 border-zinc-700"
                  style={{ 
                    height: '16px', 
                    borderLeftWidth: '2px', 
                    borderBottomWidth: '2px', 
                    borderBottomLeftRadius: '8px' 
                  }} 
                />
                {/* Vertical line continuing to the next sibling if not last */}
                {!isLast && (
                  <div 
                    className="absolute left-0 top-0 bottom-0 border-zinc-700"
                    style={{ borderLeftWidth: '2px' }} 
                  />
                )}

                <div className="pt-1 pb-3">
                  <CommentNode 
                    comment={child}
                    post={post}
                    submitText={submitText}
                    depth={depth + 1}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================
// INDIVIDUAL POST & COMMENT COMPONENT
// ==========================================
function PostItem({ post }: { post: any }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pollVoting, setPollVoting] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // The hashed uid for this session — computed once asynchronously
  const [myHash, setMyHash] = useState<string | null>(null);

  useEffect(() => {
    setSuggestedReplies(getContextualReplies(post.content));
  }, [post.content]);

  // Hash the UID once on mount
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) hashUid(uid).then(setMyHash);
  }, []);

  const uid = auth.currentUser?.uid;
  // Use hashed version for Firestore read-checks (upvotedBy etc store hashes)
  const hasUpvoted = myHash && post.upvotedBy?.includes(myHash);
  const hasDownvoted = myHash && post.downvotedBy?.includes(myHash);
  const netScore = (post.upvoteCount || 0) - (post.downvoteCount || 0);

  // Derived poll state
  const isPoll = !!post.pollOptions;
  const pollVoters: Record<string, string[]> = post.pollVoters || {};
  const myVoteIndex = isPoll
    ? post.pollOptions.findIndex((_: string, i: number) => (pollVoters[String(i)] || []).includes(myHash || ''))
    : -1;
  const hasVotedPoll = myVoteIndex !== -1;
  const totalPollVotes = isPoll
    ? post.pollOptions.reduce((_: number, __: string, i: number) => _ + (pollVoters[String(i)]?.length || 0), 0)
    : 0;

  const handleVote = async (type: 'up' | 'down') => {
    if (!myHash) return;
    const postRef = doc(db, 'posts', post.id);

    try {
      if (type === 'up') {
        if (hasUpvoted) {
          await updateDoc(postRef, { upvoteCount: increment(-1), upvotedBy: arrayRemove(myHash) });
        } else {
          await updateDoc(postRef, {
            upvoteCount: increment(1),
            upvotedBy: arrayUnion(myHash),
            ...(hasDownvoted && { downvoteCount: increment(-1), downvotedBy: arrayRemove(myHash) }),
          });
          // Check if this upvote pushes the post past the buzz threshold
          const newCount = (post.upvoteCount || 0) + 1;
          checkAndNotifyBuzz(post.id, newCount, post.text || '');
        }
      } else {
        if (hasDownvoted) {
          await updateDoc(postRef, { downvoteCount: increment(-1), downvotedBy: arrayRemove(myHash) });
        } else {
          await updateDoc(postRef, {
            downvoteCount: increment(1),
            downvotedBy: arrayUnion(myHash),
            ...(hasUpvoted && { upvoteCount: increment(-1), upvotedBy: arrayRemove(myHash) }),
          });
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const handlePollVote = async (optionIndex: number) => {
    if (!myHash || pollVoting) return;
    setPollVoting(true);
    const postRef = doc(db, 'posts', post.id);
    try {
      const update: Record<string, any> = {
        [`pollVoters.${optionIndex}`]: arrayUnion(myHash),
      };
      if (hasVotedPoll && myVoteIndex !== optionIndex) {
        update[`pollVoters.${myVoteIndex}`] = arrayRemove(myHash);
      }
      await updateDoc(postRef, update);
    } catch (error) {
      console.error("Error voting on poll:", error);
    } finally {
      setPollVoting(false);
    }
  };

  useEffect(() => {
    if (!showComments) return;

    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [post.id, showComments]);

  const submitText = async (textToSubmit: string, parentId: string | null = null) => {
    // Use hashed identity — never store raw uid in comment docs
    if (!textToSubmit.trim() || !myHash) return;
    setCommentLoading(true);
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        text: textToSubmit.trim(),
        createdAt: serverTimestamp(),
        authorUid: myHash,   // hashed, not the real Firebase uid
        parentId
      });
      await updateDoc(doc(db, 'posts', post.id), {
        commentCount: increment(1)
      });
    } catch (error) {
      console.error("Error adding comment: ", error);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitText(newComment);
    setNewComment('');
  };

  const handleQuickReply = async (reply: string) => {
    await submitText(reply);
    // Remove the chip after submitting
    setSuggestedReplies(prev => prev.filter(r => r !== reply));
  };

  const commentTree = React.useMemo(() => buildCommentTree(comments), [comments]);

  return (
    <div className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl flex flex-col transition-all">
      <div className="text-xs text-zinc-500 mb-3 flex items-center gap-2">
        <span className="font-medium text-zinc-300">Anonymous</span>
        {isPoll && (
          <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider">
            <BarChart2 className="w-3 h-3" /> POLL
          </span>
        )}
        <span>•</span>
        <span>{timeAgo(post.createdAt?.toDate())}</span>
      </div>

      {post.text && (
        <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed mb-4">
          {post.text}
        </p>
      )}

      {/* RENDER THE IMAGE IF THE POST HAS ONE */}
      {post.imageUrl && (
        <>
          {/* 1. The Feed Image (Now clickable) */}
          <div
            className="mb-4 rounded-xl overflow-hidden border border-zinc-800/50 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsFullscreen(true)}
          >
            <img src={post.imageUrl} alt="Post attachment" className="w-full h-auto object-cover max-h-96" />
          </div>

          {/* 2. The Fullscreen Lightbox Overlay */}
          {isFullscreen && (
            <div
              className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
              onClick={() => setIsFullscreen(false)}
            >
              <button type="button" onClick={() => setIsFullscreen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
              <img
                src={post.imageUrl}
                alt="Fullscreen attachment"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      )}

      {/* RENDER POLL OPTIONS */}
      {isPoll && (
        <div className="mb-4 space-y-2">
          {post.pollOptions.map((option: string, i: number) => {
            const count = pollVoters[String(i)]?.length || 0;
            const pct = totalPollVotes > 0 ? Math.round((count / totalPollVotes) * 100) : 0;
            const isMyVote = myVoteIndex === i;

            return (
              <button
                key={i}
                type="button"
                disabled={pollVoting}
                onClick={() => handlePollVote(i)}
                className={`relative w-full text-left rounded-xl border overflow-hidden transition-all
                  ${isMyVote
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                  } ${pollVoting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {/* Progress fill — only visible after voting */}
                {hasVotedPoll && (
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${isMyVote ? 'bg-indigo-500/20' : 'bg-zinc-800/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between px-4 py-3">
                  <span className={`text-sm font-medium ${isMyVote ? 'text-indigo-300' : 'text-zinc-300'}`}>
                    {option}
                  </span>
                  {/* Numbers shown only after user has voted */}
                  {hasVotedPoll && (
                    <span className={`text-xs font-bold ml-3 shrink-0 ${isMyVote ? 'text-indigo-400' : 'text-zinc-500'}`}>
                      {pct}% · {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {hasVotedPoll && (
            <p className="text-[11px] text-zinc-600 text-right mt-1">{totalPollVotes} vote{totalPollVotes !== 1 ? 's' : ''}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full px-1 py-1.5">
          <button onClick={() => handleVote('up')} className={`p-1 rounded-full hover:bg-zinc-800 transition-colors ${hasUpvoted ? 'text-indigo-500' : 'text-zinc-500 hover:text-indigo-400'}`}>
            <ArrowBigUp className="w-4 h-4" fill={hasUpvoted ? 'currentColor' : 'none'} />
          </button>
          <span className={`text-xs font-bold min-w-[14px] text-center ${hasUpvoted ? 'text-indigo-500' : 'text-zinc-400'}`}>
            {post.upvoteCount || 0}
          </span>
          <div className="w-px h-3.5 bg-zinc-700 mx-1" />
          <span className={`text-xs font-bold min-w-[14px] text-center ${hasDownvoted ? 'text-red-500' : 'text-zinc-400'}`}>
            {post.downvoteCount || 0}
          </span>
          <button onClick={() => handleVote('down')} className={`p-1 rounded-full hover:bg-zinc-800 transition-colors ${hasDownvoted ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}>
            <ArrowBigDown className="w-4 h-4" fill={hasDownvoted ? 'currentColor' : 'none'} />
          </button>
        </div>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors ${showComments ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
        >
          <MessageSquare className="w-4 h-4" />
          {post.commentCount || 0}
        </button>

        {/* Share Button */}
        <div className="relative">
          <button
            onClick={() => setShowShareSheet(!showShareSheet)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Share Sheet Dropdown */}
          {showShareSheet && (
            <>
              {/* Backdrop to close */}
              <div className="fixed inset-0 z-40" onClick={() => setShowShareSheet(false)} />
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Copy Link */}
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    setLinkCopied(true);
                    setTimeout(() => { setLinkCopied(false); setShowShareSheet(false); }, 1500);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>

                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
                    const text = `Check this out on Base67 🔥\n${shareUrl}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    setShowShareSheet(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.111.553 4.095 1.519 5.815L.058 23.549a.5.5 0 00.633.633l5.735-1.462A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.378-1.575l-.386-.23-3.403.868.882-3.212-.253-.402A9.935 9.935 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
                  </svg>
                  WhatsApp
                </button>

                {/* Instagram — copies link since IG has no web share API */}
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    setLinkCopied(true);
                    setTimeout(() => { setLinkCopied(false); setShowShareSheet(false); }, 1500);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  Instagram
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50">
          <div className="mb-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {commentTree.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-2">No comments yet. Start the conversation!</p>
            ) : (
              commentTree.map(comment => (
                <CommentNode 
                  key={comment.id}
                  comment={comment}
                  post={post}
                  submitText={submitText}
                />
              ))
            )}
          </div>

          {/* Quick Replies */}
          {suggestedReplies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedReplies.map(reply => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => handleQuickReply(reply)}
                  disabled={commentLoading}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium rounded-full transition-colors disabled:opacity-50"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCommentSubmit} className="relative flex items-center">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add an anonymous comment..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-4 pr-10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              maxLength={200}
            />
            <button
              type="submit"
              disabled={commentLoading || !newComment.trim()}
              className="absolute right-2 p-1.5 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN FEED COMPONENT
// ==========================================
// ---- Pagination constants ----
const PAGE_SIZE = 10;
const BUZZIN_PAGE_SIZE = 30; // wider window for velocity scoring

export default function Feed() {
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [postedSuccess, setPostedSuccess] = useState(false);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feed tab state
  const [activeTab, setActiveTab] = useState<'buzzin' | 'new' | 'top'>('buzzin');
  const [topFilter, setTopFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

  // Poll compose state
  const [isPollMode, setIsPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Pagination state
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const clearImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePollMode = () => {
    setIsPollMode((prev) => {
      if (prev) setPollOptions(['', '']); // reset on close
      return !prev;
    });
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions((prev) => [...prev, '']);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Build the base Firestore query (no cursor, no limit) ──────────────────
  const buildBaseQuery = () => {
    const postsRef = collection(db, 'posts');
    if (activeTab === 'new') {
      return query(postsRef, orderBy('createdAt', 'desc'));
    } else if (activeTab === 'top') {
      if (topFilter === 'all') {
        return query(postsRef, orderBy('upvoteCount', 'desc'));
      } else {
        const now = new Date();
        const cutoff = new Date(now);
        if (topFilter === 'today') cutoff.setHours(0, 0, 0, 0);
        else if (topFilter === 'week') cutoff.setDate(now.getDate() - 7);
        else if (topFilter === 'month') cutoff.setDate(now.getDate() - 30);
        return query(
          postsRef,
          where('createdAt', '>=', Timestamp.fromDate(cutoff)),
          orderBy('createdAt', 'desc')
        );
      }
    } else {
      // buzzin' — ordered by recency; velocity sort happens client-side
      return query(postsRef, orderBy('createdAt', 'desc'));
    }
  };

  // ── Page 1: real-time listener so new posts appear instantly ─────────────
  useEffect(() => {
    // Reset pagination state on tab/filter change
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);
    setInitialLoading(true);

    const pageSize = activeTab === 'buzzin' ? BUZZIN_PAGE_SIZE : PAGE_SIZE;
    const q = query(buildBaseQuery(), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawDocs = snapshot.docs;
      let fetched: any[] = rawDocs.map(d => ({ id: d.id, ...d.data() }));

      if (activeTab === 'buzzin') {
        fetched = [...fetched].sort((a, b) => getBuzzScore(b) - getBuzzScore(a));
      } else if (activeTab === 'top' && topFilter !== 'all') {
        fetched = [...fetched].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
      }

      // Keep any pages 2+ that were already loaded, replace only page 1 slice
      setPosts(prev => {
        if (prev.length <= pageSize) return fetched;
        // Merge: update the first-page docs in-place, keep the rest
        const updatedIds = new Set(fetched.map((p: any) => p.id));
        const tail = prev.slice(pageSize).filter((p: any) => !updatedIds.has(p.id));
        return [...fetched, ...tail];
      });

      setLastDoc(rawDocs[rawDocs.length - 1] ?? null);
      setHasMore(rawDocs.length === pageSize);
      setInitialLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, topFilter]);

  // ── Load more (pages 2+): one-time getDocs with cursor ───────────────────
  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const pageSize = activeTab === 'buzzin' ? BUZZIN_PAGE_SIZE : PAGE_SIZE;
      const q = query(buildBaseQuery(), startAfter(lastDoc), limit(pageSize));
      const snapshot = await getDocs(q);
      const rawDocs = snapshot.docs;

      let fetched: any[] = rawDocs.map(d => ({ id: d.id, ...d.data() }));
      if (activeTab === 'buzzin') {
        fetched = [...fetched].sort((a, b) => getBuzzScore(b) - getBuzzScore(a));
      } else if (activeTab === 'top' && topFilter !== 'all') {
        fetched = [...fetched].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
      }

      setPosts(prev => {
        const existingIds = new Set(prev.map((p: any) => p.id));
        const newOnes = fetched.filter((p: any) => !existingIds.has(p.id));
        return [...prev, ...newOnes];
      });
      setLastDoc(rawDocs[rawDocs.length - 1] ?? lastDoc);
      setHasMore(rawDocs.length === pageSize);
    } catch (err) {
      console.error('loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── IntersectionObserver: trigger loadMore 200px before sentinel ─────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, lastDoc]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;

    const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    const isPoll = isPollMode && validOptions.length >= 2;

    if ((!newPost.trim() && !imageFile && !isPoll) || !uid) return;

    setLoading(true);
    try {
      let imageUrl = null;

      // CLOUDINARY UNSIGNED UPLOAD
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        formData.append('upload_preset', 'campus_feed');

        const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/dgytyrp5r/image/upload`, {
          method: 'POST',
          body: formData
        });

        if (!cloudinaryRes.ok) {
          const errorData = await cloudinaryRes.json();
          console.error("Cloudinary Error:", errorData);
          throw new Error(errorData.error?.message || "Cloudinary upload failed");
        }

        const cloudinaryData = await cloudinaryRes.json();
        imageUrl = cloudinaryData.secure_url;
      }

      // Build poll voters map: { "0": [], "1": [], ... }
      const pollVoters = isPoll
        ? Object.fromEntries(validOptions.map((_, i) => [String(i), []]))
        : null;

      // Save to Firestore — authorUid is the HASHED uid, not the real one
      const authorHash = await hashUid(uid);
      await addDoc(collection(db, 'posts'), {
        text: newPost.trim(),
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        upvoteCount: 0,
        downvoteCount: 0,
        upvotedBy: [],
        downvotedBy: [],
        commentCount: 0,
        authorUid: authorHash,   // hashed — cannot be linked to email
        ...(isPoll && {
          pollOptions: validOptions,
          pollVoters,
        }),
      });

      setNewPost('');
      clearImage();
      if (isPollMode) {
        setIsPollMode(false);
        setPollOptions(['', '']);
      }

      // Show success toast
      setPostedSuccess(true);
      setTimeout(() => setPostedSuccess(false), 3000);

    } catch (error) {
      console.error("Error adding post: ", error);
      alert("Failed to post. Check your console.");
    } finally {
      setLoading(false);
    }
  };

  const isPoll = isPollMode && pollOptions.filter((o) => o.trim()).length >= 2;
  const canPost = isPoll || !!newPost.trim() || !!imageFile;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      {/* Sticky header: nav + tab bar move as one unit */}
      <div className="sticky top-0 z-20 bg-zinc-950 backdrop-blur-md">
        <nav className="border-b border-zinc-900 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Base67 logo" className="w-7 h-7 object-contain" />
            <h1 className="font-bold tracking-tight" style={{ fontSize: '27px' }}>Base<span style={{ color: '#7f00ff' }}>67</span></h1>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-colors" style={{ transform: 'scale(0.9)' }}>
            <LogOut className="w-5 h-5" />
          </button>
        </nav>

        {/* Filter chip row — YouTube style */}
        <div className="border-b border-zinc-900 px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {([
            { id: 'buzzin', label: "Buzzin'" },
            { id: 'new', label: 'New' },
            { id: 'top', label: 'Top' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-150 shrink-0
                ${activeTab === id
                  ? '!bg-white !text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {label}
            </button>
          ))}

          {/* Sub-filter for Top — inline after a divider */}
          {activeTab === 'top' && (
            <>
              <div className="w-px h-3.5 bg-zinc-700 mx-0.5 shrink-0" />
              {([
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTopFilter(id)}
                  className={`px-3 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-150 shrink-0
                    ${topFilter === id
                      ? 'bg-[#7f00ff] text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </div>

      </div>{/* end sticky header */}

      {/* Success Toast */}
      {postedSuccess && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-[#7f00ff] text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2">
            ✅ Posted!
          </div>
        </div>
      )}

      <main className="w-full p-4">
        {/* Composer - Compact when blurred, Expanded when focused */}
        <form
          onSubmit={handlePost}
          onFocus={() => setIsComposerFocused(true)}
          className={`mb-8 border border-zinc-800 rounded-[24px] bg-zinc-900 transition-all duration-300 ${isComposerFocused || newPost || isPollMode || imageFile ? 'pb-3' : 'pb-0'}`}
        >
          <div className="flex flex-col">
            {/* Input Row */}
            <div className="flex items-start gap-2 p-3 pb-1">
              <div className="flex-1 flex flex-col">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value && !isPollMode && !imageFile) {

                      setIsComposerFocused(false);
                    }
                  }}
                  placeholder={isPollMode ? "Ask a question..." : "What's happening on campus?"}
                  className={`w-full bg-transparent text-zinc-100 placeholder-zinc-500 py-2 focus:outline-none resize-none transition-all duration-300 ${isComposerFocused || newPost || isPollMode || imageFile ? 'min-h-[56px]' : 'min-h-[36px]'}`}
                  maxLength={280}
                />

                {/* Poll Options Builder */}
                {isPollMode && (
                  <div className="px-4 pb-3 space-y-2">
                    {pollOptions.map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updatePollOption(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          maxLength={80}
                          className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removePollOption(i)}
                            className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 4 && (
                      <button
                        type="button"
                        onClick={addPollOption}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-indigo-400 transition-colors py-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add option
                      </button>
                    )}
                  </div>
                )}

                {/* Image Preview */}
                {imageFile && (
                  <div className="relative inline-block mt-2 mb-1">
                    <img
                      src={URL.createObjectURL(imageFile)}
                      alt="Preview"
                      className="max-h-36 rounded-xl border border-zinc-700 object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Action Row attached to bottom of textarea */}
                <div className={`flex items-center justify-between transition-all duration-300 overflow-hidden ${isComposerFocused || newPost || isPollMode || imageFile ? 'h-11 mt-1 opacity-100' : 'h-0 opacity-0'}`}>
                  {/* Icons (Left) */}
                  <div className="flex items-center gap-1 -ml-1">
                    <button
                      type="button"
                      onClick={togglePollMode}
                      className={`p-2 rounded-full transition-colors ${isPollMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800'}`}
                      title="Create poll"
                    >
                      <BarChart2 className="w-5 h-5" />
                    </button>

                    <label htmlFor="post-image-input" className="cursor-pointer p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-full transition-colors m-0">
                      <ImageIcon className="w-5 h-5" />
                    </label>
                  </div>

                  {/* Post Button (Right) */}
                  <button
                    type="submit"
                    disabled={loading || !canPost}
                    className={`px-5 py-2 rounded-full text-sm font-bold tracking-wide transition-all ${canPost ? 'bg-[#7f00ff] text-white hover:bg-[#6b00d6]' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin my-0.5 mx-2" />
                    ) : (
                      'Post'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Hidden file input — outside overflow-hidden so it's always accessible */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            id="post-image-input"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </form>

        {/* Posts list */}
        {initialLoading ? (
          // Skeleton placeholders
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-zinc-800 rounded w-3/4 mb-3" />
                <div className="h-3 bg-zinc-800 rounded w-1/2 mb-3" />
                <div className="h-3 bg-zinc-800 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostItem key={post.id} post={post} />
            ))}

            {/* Sentinel div — IntersectionObserver target */}
            <div ref={sentinelRef} className="h-1" />

            {/* Loading spinner for page 2+ */}
            {loadingMore && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            )}

            {/* End of feed */}
            {!hasMore && posts.length > 0 && !loadingMore && (
              <p className="text-center text-xs text-zinc-600 py-6 tracking-wide">you've seen it all 👀</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
