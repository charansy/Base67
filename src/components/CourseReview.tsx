import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import {
    collection, doc, setDoc, addDoc, onSnapshot,
    serverTimestamp, query, orderBy, collectionGroup, where
} from 'firebase/firestore';
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Plus, X } from 'lucide-react';
import { Course, Department } from '../data/academicData';
import { hashUid } from '../utils/hashUid';

// ==========================================
// TYPES
// ==========================================
interface Review {
    uid: string;
    cpiThreat: number;
    attendance: 'strict80' | 'flexible' | 'easy70';
    passTags: string[];
    survivalHack: string;
    createdAt: any;
}

interface Material {
    id: string;
    uid: string;
    title: string;
    link: string;
    type: 'PYQ' | 'Notes' | 'Textbook' | 'Assignment' | 'Other';
    createdAt: any;
}

const PASS_TAGS = [
    'All Qs from Notes',
    'Qs from PYQs',
    'Qs from Ref. Books',
    'Easy Exams',
    'Just Attend Classes',
    'Brutal Exams',
    'Heavy Projects',
    'Time Consuming',
    'Simple but Grunt',
    'Hard AF',
] as const;

const MATERIAL_TYPES = ['PYQ', 'Notes', 'Textbook', 'Assignment', 'Other'] as const;

const MATERIAL_TYPE_COLORS: Record<Material['type'], string> = {
    PYQ: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    Notes: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    Textbook: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Assignment: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    Other: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/30',
};

// ==========================================
// HELPERS
// ==========================================
const threatLabel = (score: number) => {
    if (score <= 1.5) return { text: 'Easy A', color: '#22c55e' };
    if (score <= 2.5) return { text: 'Fair Grading', color: '#86efac' };
    if (score <= 3.5) return { text: 'Manageable', color: '#facc15' };
    if (score <= 4.5) return { text: 'Watch Out', color: '#f97316' };
    return { text: 'CPI Destroyer', color: '#ef4444' };
};

const sliderThumbColor = (val: number) => {
    if (val <= 1) return '#22c55e';
    if (val <= 2) return '#86efac';
    if (val <= 3) return '#facc15';
    if (val <= 4) return '#f97316';
    return '#ef4444';
};

// ==========================================
// AGGREGATE DASHBOARD
// ==========================================
function AggregateDashboard({ reviews }: { reviews: Review[] }) {
    if (reviews.length === 0) return null;

    const avgCpi = reviews.reduce((s, r) => s + r.cpiThreat, 0) / reviews.length;
    const attCounts = { strict80: 0, flexible: 0, easy70: 0 };
    reviews.forEach(r => { if (r.attendance in attCounts) attCounts[r.attendance as keyof typeof attCounts]++; });
    const attendanceMajority = (Object.entries(attCounts).sort((a, b) => b[1] - a[1])[0][0]) as 'strict80' | 'flexible' | 'easy70';

    const tagCounts: Record<string, number> = {};
    reviews.forEach(r => r.passTags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const { text: threatText, color: threatColor } = threatLabel(avgCpi);

    return (
        <div className="mx-4 mb-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800/40 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Survival Stats</span>
                <span className="text-xs text-zinc-500">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Threat Level</span>
                    <span className="text-2xl font-bold" style={{ color: threatColor }}>{avgCpi.toFixed(1)}</span>
                    <span className="text-[10px] font-medium" style={{ color: threatColor }}>{threatText}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Attendance</span>
                    <span className="text-xl mt-0.5">{attendanceMajority === 'strict80' ? '🔴' : attendanceMajority === 'flexible' ? '🟡' : '🟢'}</span>
                    <span className="text-[10px] font-medium text-zinc-300">
                        {attendanceMajority === 'strict80' ? 'Strict 80%' : attendanceMajority === 'flexible' ? "Doesn't Matter" : 'Ok till 70%'}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Top Tags</span>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                        {topTags.length === 0
                            ? <span className="text-[10px] text-zinc-600">—</span>
                            : topTags.map(([tag, count]) => (
                                <span key={tag} className="text-[10px] text-[#a855f7] font-medium leading-tight">
                                    {tag} <span className="text-zinc-600">·{count}</span>
                                </span>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// REVIEW CARD
// ==========================================
function ReviewCard({ review }: { review: Review }) {
    const { text: threatText, color: threatColor } = threatLabel(review.cpiThreat);
    return (
        <div className="mx-4 mb-3 p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/40">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: `${threatColor}20`, color: threatColor }}>
                    ⚡ {review.cpiThreat}/5 · {threatText}
                </span>
                <span className="text-xs font-medium text-zinc-400">
                    {review.attendance === 'strict80' ? '🔴 Strict 80%' : review.attendance === 'flexible' ? "🟡 Doesn't Matter" : '🟢 Ok till 70%'}
                </span>
            </div>
            {review.passTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {review.passTags.map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-[#7f00ff]/10 border border-[#7f00ff]/20 text-[#a855f7] font-medium">
                            🏷 {tag}
                        </span>
                    ))}
                </div>
            )}
            {review.survivalHack && (
                <p className="text-[13px] text-zinc-300 leading-relaxed italic border-l-2 border-zinc-700 pl-3">
                    "{review.survivalHack}"
                </p>
            )}
            <p className="text-[10px] text-zinc-600 mt-2">
                {review.createdAt?.toDate?.().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) ?? '—'}
            </p>
        </div>
    );
}

// ==========================================
// WRITE REVIEW FORM
// ==========================================
function WriteReview({ courseId, existingReview, onClose }: {
    courseId: string;
    existingReview: Review | null;
    onClose: () => void;
}) {
    const [cpiThreat, setCpiThreat] = useState(existingReview?.cpiThreat ?? 3);
    const [attendance, setAttendance] = useState<'strict80' | 'flexible' | 'easy70'>(existingReview?.attendance ?? 'flexible');
    const [passTags, setPassTags] = useState<string[]>(existingReview?.passTags ?? []);
    const [survivalHack, setSurvivalHack] = useState(existingReview?.survivalHack ?? '');
    const [saving, setSaving] = useState(false);
    const uid = auth.currentUser?.uid;
    const thumbColor = sliderThumbColor(cpiThreat);

    const toggleTag = (tag: string) => setPassTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

    const handleSubmit = async () => {
        if (!uid) return;
        setSaving(true);
        try {
            // Hash uid before storing — never expose real Firebase uid in Firestore
            const authorHash = await hashUid(uid);
            await setDoc(doc(db, 'courseReviews', courseId, 'reviews', authorHash), {
                uid: authorHash, cpiThreat, attendance, passTags,
                survivalHack: survivalHack.trim(),
                createdAt: serverTimestamp(),
            });
            onClose();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const cpiLabels: Record<number, string> = {
        1: 'Free 10 (Easy A)', 2: 'Mostly Chill', 3: 'Fair Grading', 4: 'Watch Out', 5: 'CPI Destroyer',
    };

    return (
        <div className="mx-4 mb-4 rounded-2xl border border-[#7f00ff]/30 bg-zinc-900/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40">
                <h3 className="text-sm font-semibold text-zinc-100">{existingReview ? 'Update Your Review' : 'Leave a Review'}</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">Anonymous · Takes ~8 seconds</p>
            </div>
            <div className="p-4 space-y-5">
                {/* CPI Threat */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-300">1. CPI Threat Level</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${thumbColor}25`, color: thumbColor }}>
                            {cpiThreat} · {cpiLabels[cpiThreat]}
                        </span>
                    </div>
                    <input type="range" min={1} max={5} step={1} value={cpiThreat}
                        onChange={e => setCpiThreat(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, ${thumbColor} ${(cpiThreat - 1) * 25}%, #3f3f46 ${(cpiThreat - 1) * 25}%)` }} />
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-zinc-600">Free 10</span>
                        <span className="text-[10px] text-zinc-600">CPI Destroyer</span>
                    </div>
                </div>

                {/* Attendance */}
                <div>
                    <span className="text-xs font-semibold text-zinc-300 block mb-2">2. Attendance Reality</span>
                    <div className="flex rounded-xl overflow-hidden border border-zinc-700 text-xs font-medium">
                        <button type="button" onClick={() => setAttendance('strict80')}
                            className={`flex-1 py-2.5 transition-colors ${attendance === 'strict80' ? 'bg-red-500/80 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                            🔴 Strict 80%
                        </button>
                        <div className="w-px bg-zinc-700" />
                        <button type="button" onClick={() => setAttendance('flexible')}
                            className={`flex-1 py-2.5 transition-colors ${attendance === 'flexible' ? 'bg-yellow-600/70 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                            🟡 Doesn't Matter
                        </button>
                        <div className="w-px bg-zinc-700" />
                        <button type="button" onClick={() => setAttendance('easy70')}
                            className={`flex-1 py-2.5 transition-colors ${attendance === 'easy70' ? 'bg-green-600/70 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                            🟢 Ok till 70%
                        </button>
                    </div>
                </div>

                {/* Pass Tags */}
                <div>
                    <div className="mb-2">
                        <span className="text-xs font-semibold text-zinc-300">3. Pass Condition</span>
                        <span className="text-[10px] text-zinc-500 ml-2">Select all that apply</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {PASS_TAGS.map(tag => {
                            const selected = passTags.includes(tag);
                            return (
                                <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${selected ? 'bg-[#7f00ff] border-[#7f00ff] text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                        }`}>
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Survival Hack */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-300">4. Survival Hack</span>
                        <span className={`text-[10px] ${survivalHack.length > 130 ? 'text-orange-400' : 'text-zinc-500'}`}>
                            {150 - survivalHack.length} left
                        </span>
                    </div>
                    <textarea value={survivalHack} onChange={e => setSurvivalHack(e.target.value.slice(0, 150))}
                        placeholder="What is the ONE thing someone must know to survive this course?"
                        rows={3}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#7f00ff]/50 resize-none transition-all" />
                </div>

                <button type="button" onClick={handleSubmit} disabled={saving}
                    className="w-full py-3 rounded-xl bg-[#7f00ff] hover:bg-[#6d00e0] disabled:opacity-50 text-white text-sm font-semibold transition-all">
                    {saving ? 'Saving…' : existingReview ? 'Update Review' : 'Post Review'}
                </button>
            </div>
        </div>
    );
}

// ==========================================
// MATERIAL CARD
// ==========================================
function MaterialCard({ material }: { material: Material }) {
    const colorClass = MATERIAL_TYPE_COLORS[material.type];
    return (
        <div className="mx-4 mb-3 p-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/40 flex items-start gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                        {material.type}
                    </span>
                </div>
                <p className="text-sm font-medium text-zinc-200 leading-snug">{material.title}</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                    {material.createdAt?.toDate?.().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) ?? '—'}
                </p>
            </div>
            <a href={material.link} target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors">
                Open <ExternalLink className="w-3 h-3" />
            </a>
        </div>
    );
}

// ==========================================
// ADD MATERIAL FORM
// ==========================================
function AddMaterial({ courseId, onClose }: { courseId: string; onClose: () => void }) {
    const [title, setTitle] = useState('');
    const [link, setLink] = useState('');
    const [type, setType] = useState<Material['type']>('PYQ');
    const [saving, setSaving] = useState(false);
    const uid = auth.currentUser?.uid;

    const handleSubmit = async () => {
        if (!uid || !title.trim() || !link.trim()) return;
        setSaving(true);
        try {
            // Hash uid before storing — never expose real Firebase uid in Firestore
            const authorHash = await hashUid(uid);
            await addDoc(collection(db, 'courseMaterials', courseId, 'materials'), {
                uid: authorHash, title: title.trim(), link: link.trim(), type,
                createdAt: serverTimestamp(),
            });
            onClose();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    return (
        <div className="mx-4 mb-4 rounded-2xl border border-[#7f00ff]/30 bg-zinc-900/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Share a Resource</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">PYQs, Notes, Drive links, etc.</p>
                </div>
                <button type="button" onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 !bg-transparent border-0">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="p-4 space-y-4">
                {/* Type selector */}
                <div>
                    <span className="text-xs font-semibold text-zinc-300 block mb-2">Type</span>
                    <div className="flex flex-wrap gap-2">
                        {MATERIAL_TYPES.map(t => (
                            <button key={t} type="button" onClick={() => setType(t)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${type === t ? 'bg-[#7f00ff] border-[#7f00ff] text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                    }`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div>
                    <span className="text-xs font-semibold text-zinc-300 block mb-1.5">Title</span>
                    <input value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. EP201 Midsem 2023, Chapter 3 Notes"
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#7f00ff]/50 transition-all" />
                </div>

                {/* Link */}
                <div>
                    <span className="text-xs font-semibold text-zinc-300 block mb-1.5">Drive / PDF Link</span>
                    <input value={link} onChange={e => setLink(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        type="url"
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#7f00ff]/50 transition-all" />
                </div>

                <button type="button" onClick={handleSubmit}
                    disabled={saving || !title.trim() || !link.trim()}
                    className="w-full py-3 rounded-xl bg-[#7f00ff] hover:bg-[#6d00e0] disabled:opacity-40 text-white text-sm font-semibold transition-all">
                    {saving ? 'Sharing…' : 'Share Resource'}
                </button>
            </div>
        </div>
    );
}

// ==========================================
// MAIN: COURSE REVIEW PAGE
// ==========================================
interface Props {
    course: Course;
    dept: Department;
    onBack: () => void;
}

export default function CourseReview({ course, dept, onBack }: Props) {
    const [activeTab, setActiveTab] = useState<'reviews' | 'materials'>('reviews');
    const [reviews, setReviews] = useState<Review[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [hasUnlockedMaterials, setHasUnlockedMaterials] = useState<boolean>(false);
    const [checkingUnlock, setCheckingUnlock] = useState(true);
    const uid = auth.currentUser?.uid;
    const courseId = `${dept.id}_${course.code}`;

    // Check if user has uploaded *any* material globally to unlock access
    useEffect(() => {
        if (!uid) {
            setCheckingUnlock(false);
            return;
        }

        let unsubscribe = () => {};

        const checkUnlockStatus = async () => {
            try {
                const authorHash = await hashUid(uid);
                const q = query(
                    collectionGroup(db, 'materials'), 
                    where('uid', '==', authorHash)
                );
                
                unsubscribe = onSnapshot(q, (snap) => {
                    setHasUnlockedMaterials(!snap.empty);
                    setCheckingUnlock(false);
                }, (error) => {
                    console.error("Error checking material access:", error);
                    // Fallback to true if rules block it during dev, or handle gracefully
                    setHasUnlockedMaterials(true);
                    setCheckingUnlock(false);
                });
            } catch (err) {
                console.error("Error setting up unlock listener", err);
                setCheckingUnlock(false);
            }
        };

        checkUnlockStatus();

        return () => unsubscribe();
    }, [uid]);

    // Live reviews
    useEffect(() => {
        const q = query(collection(db, 'courseReviews', courseId, 'reviews'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setReviews(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Review)));
        });
    }, [courseId]);

    // Live materials
    useEffect(() => {
        const q = query(collection(db, 'courseMaterials', courseId, 'materials'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
        });
    }, [courseId]);

    const myReview = useMemo(() => reviews.find(r => r.uid === uid) ?? null, [reviews, uid]);

    // Close form when switching tabs
    const switchTab = (tab: 'reviews' | 'materials') => {
        setActiveTab(tab);
        setShowForm(false);
    };

    return (
        <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">

            {/* ---- Sticky Header ---- */}
            <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900">
                {/* Back + course name row */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-3">
                    <button type="button" onClick={onBack}
                        className="p-1.5 -ml-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors shrink-0 !bg-transparent border-0 focus:outline-none">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-[#a855f7] bg-[#7f00ff]/10 px-1.5 py-0.5 rounded-md shrink-0">
                                {course.code}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-400 truncate">{course.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{dept.emoji} {dept.name}</p>
                    </div>
                </div>

                {/* Tab pills */}
                <div className="px-4 pb-2.5 flex gap-2">
                    {(['reviews', 'materials'] as const).map(tab => (
                        <button key={tab} type="button" onClick={() => switchTab(tab)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border-0 focus:outline-none capitalize ${activeTab === tab
                                ? '!bg-white !text-black'
                                : '!bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}>
                            {tab === 'reviews' ? `Reviews${reviews.length ? ` · ${reviews.length}` : ''}` : `Materials${materials.length ? ` · ${materials.length}` : ''}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* ---- Content ---- */}
            <div className="pb-28 pt-4">

                {activeTab === 'reviews' ? (
                    <>
                        <AggregateDashboard reviews={reviews} />

                        {/* Rate CTA */}
                        <div className="mx-4 mb-4">
                            <button type="button" onClick={() => setShowForm(v => !v)}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-0 text-sm font-semibold transition-all focus:outline-none ${showForm
                                    ? '!bg-zinc-800 text-zinc-300'
                                    : '!bg-[#7f00ff]/10 text-[#a855f7] hover:bg-[#7f00ff]/20'
                                    }`}>
                                {showForm
                                    ? <><ChevronUp className="w-4 h-4" /> Hide Form</>
                                    : myReview
                                        ? <><ChevronDown className="w-4 h-4" /> Edit Your Review</>
                                        : <><ChevronDown className="w-4 h-4" /> Rate This Course</>
                                }
                            </button>
                        </div>

                        {showForm && (
                            <WriteReview courseId={courseId} existingReview={myReview} onClose={() => setShowForm(false)} />
                        )}

                        {reviews.length === 0 ? (
                            <div className="text-center py-16 px-6">
                                <p className="text-3xl mb-3">🎓</p>
                                <p className="text-zinc-400 text-sm font-medium">No reviews yet.</p>
                                <p className="text-zinc-600 text-xs mt-1">Be the first senior to drop a survival hack.</p>
                            </div>
                        ) : (
                            <>
                                <div className="mx-4 mb-3">
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Reviews</p>
                                </div>
                                {reviews.map(r => <ReviewCard key={r.uid} review={r} />)}
                            </>
                        )}
                    </>
                ) : (
                    /* ===== MATERIALS TAB ===== */
                    <>
                        {/* Share CTA */}
                        <div className="mx-4 mb-4">
                            <button type="button" onClick={() => setShowForm(v => !v)}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-0 text-sm font-semibold transition-all focus:outline-none ${showForm ? '!bg-zinc-800 text-zinc-300' : '!bg-[#7f00ff]/10 text-[#a855f7]'
                                    }`}>
                                {showForm
                                    ? <><X className="w-4 h-4" /> Cancel</>
                                    : <><Plus className="w-4 h-4" /> Share a Resource</>
                                }
                            </button>
                        </div>

                        {showForm && <AddMaterial courseId={courseId} onClose={() => setShowForm(false)} />}

                        {/* Filter by type */}
                        {materials.length > 0 && (
                            <div className="mx-4 mb-3 flex items-center justify-between">
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                                    Resources · {materials.length}
                                </p>
                                {!hasUnlockedMaterials && !checkingUnlock && (
                                    <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                                        🔒 Locked
                                    </span>
                                )}
                            </div>
                        )}

                        {checkingUnlock ? (
                           <div className="text-center py-10">
                                <div className="w-5 h-5 mx-auto border-2 border-[#7f00ff] border-t-transparent rounded-full animate-spin" />
                           </div>
                        ) : !hasUnlockedMaterials ? (
                            <div className="mx-4 mb-6 p-6 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mb-3">
                                    <span className="text-2xl">🔒</span>
                                </div>
                                <h4 className="text-sm font-bold text-orange-400 mb-2">Reciprocity Gate Active</h4>
                                <p className="text-xs text-zinc-400 leading-relaxed max-w-[250px] mb-4">
                                    To view resources shared by others, you must first contribute to the community. 
                                    <br/><br/>
                                    <strong>Post a material for this or any other course to permanently unlock all resources.</strong>
                                </p>
                                
                                <button type="button" onClick={() => setShowForm(true)}
                                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20">
                                    Share a Resource to Unlock
                                </button>
                                
                                {/* Blurred background preview of items to entice users */}
                                {materials.length > 0 && (
                                   <div className="mt-8 w-full opacity-30 pointer-events-none filter blur-sm select-none">
                                        {materials.slice(0, 2).map((m, i) => (
                                           <div key={i} className="mb-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-left flex items-center gap-2">
                                              <div className="w-8 h-4 rounded bg-zinc-700"></div>
                                              <div className="h-3 w-3/4 rounded bg-zinc-600"></div>
                                           </div>
                                        ))}
                                   </div>
                                )}
                            </div>
                        ) : materials.length === 0 ? (
                            <div className="text-center py-16 px-6">
                                <p className="text-3xl mb-3">📂</p>
                                <p className="text-zinc-400 text-sm font-medium">No resources yet.</p>
                                <p className="text-zinc-600 text-xs mt-1">Share a PYQ, notes PDF, or drive link to help your juniors.</p>
                            </div>
                        ) : (
                            materials.map(m => <MaterialCard key={m.id} material={m} />)
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
