import React, { useState, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { departments, Department, Course } from '../data/academicData';
import CourseReview from './CourseReview';

// ==========================================
// ACAD — ACADEMIC SECTION
// ==========================================
export default function Acad() {
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ---------- Filtered data ----------
    const filteredDepartments = useMemo(() => {
        if (!searchQuery.trim()) return departments;
        const q = searchQuery.toLowerCase();
        return departments.filter(
            (d) =>
                d.name.toLowerCase().includes(q) ||
                d.courses.some(
                    (c) =>
                        c.name.toLowerCase().includes(q) ||
                        c.code.toLowerCase().includes(q)
                )
        );
    }, [searchQuery]);

    const filteredCourses = useMemo(() => {
        if (!selectedDept) return [];
        if (!searchQuery.trim()) return selectedDept.courses;
        const q = searchQuery.toLowerCase();
        return selectedDept.courses.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q)
        );
    }, [selectedDept, searchQuery]);

    const handleDeptClick = (dept: Department) => {
        setSelectedDept(dept);
        setSearchQuery('');
    };

    const handleCourseClick = (course: Course) => {
        setSelectedCourse(course);
        setSearchQuery('');
    };

    const handleBackFromCourse = () => {
        setSelectedCourse(null);
    };

    const handleBackFromDept = () => {
        setSelectedDept(null);
        setSearchQuery('');
    };

    // ---------- Course Review drill-down ----------
    if (selectedCourse && selectedDept) {
        return (
            <CourseReview
                course={selectedCourse}
                dept={selectedDept}
                onBack={handleBackFromCourse}
            />
        );
    }

    return (
        <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
            {/* -------- Sticky Header -------- */}
            <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900">
                {/* Logo row */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-3">
                    {selectedDept && (
                        <button
                            type="button"
                            onClick={handleBackFromDept}
                            className="p-1.5 -ml-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Base67 logo" className="w-7 h-7 object-contain" />
                        <h1 className="font-bold tracking-tight" style={{ fontSize: '27px' }}>
                            Base<span style={{ color: '#7f00ff' }}>67</span>
                        </h1>
                    </div>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                                selectedDept
                                    ? `Search in ${selectedDept.name}...`
                                    : 'Search departments or courses...'
                            }
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#7f00ff]/60 focus:border-[#7f00ff]/40 transition-all"
                        />
                    </div>
                </div>

                {/* Department header bar when in course view */}
                {selectedDept && (
                    <div className="px-4 pb-3 flex items-center gap-3">
                        <span className="text-2xl">{selectedDept.emoji}</span>
                        <div>
                            <h2 className="text-base font-semibold text-zinc-100 leading-tight">
                                {selectedDept.name}
                            </h2>
                            <p className="text-xs text-zinc-500">
                                {selectedDept.courses.length} courses · tap a course to review
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* -------- Main Content -------- */}
            <main className="w-full p-4 pb-24">
                {!selectedDept ? (
                    /* ========= DEPARTMENT GRID ========= */
                    <>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-4">
                            Departments
                        </p>
                        {filteredDepartments.length === 0 ? (
                            <div className="text-center py-16">
                                <p className="text-zinc-500 text-sm">No departments match your search.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredDepartments.map((dept) => (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => handleDeptClick(dept)}
                                        className="group relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/50 hover:border-[#7f00ff]/40 hover:bg-[#7f00ff]/5 active:scale-[0.97] transition-all duration-200 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#7f00ff]/5 via-transparent to-indigo-500/5 pointer-events-none" />
                                        <span className="text-3xl relative z-10">{dept.emoji}</span>
                                        <span className="text-sm font-medium text-zinc-200 relative z-10 text-center leading-tight">
                                            {dept.name}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 relative z-10">
                                            {dept.courses.length} courses
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* ========= COURSE LIST ========= */
                    <>
                        {filteredCourses.length === 0 ? (
                            <div className="text-center py-16">
                                <p className="text-zinc-500 text-sm">No courses match your search.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredCourses.map((course) => (
                                    <button
                                        key={course.code}
                                        type="button"
                                        onClick={() => handleCourseClick(course)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/40 hover:border-[#7f00ff]/30 hover:bg-[#7f00ff]/5 active:scale-[0.99] transition-all text-left"
                                    >
                                        <span className="shrink-0 w-16 text-xs font-mono font-bold text-[#a855f7] bg-[#7f00ff]/10 px-2 py-1 rounded-lg text-center">
                                            {course.code}
                                        </span>
                                        <span className="text-sm text-zinc-200 leading-snug flex-1">
                                            {course.name}
                                        </span>
                                        <span className="text-zinc-600 text-xs shrink-0">›</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
