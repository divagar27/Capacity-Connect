'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Search, Users } from 'lucide-react';
import { apiRequest } from '../../lib/api';

type Course = { id: string; title: string; description: string; level: string; durationMins?: number; subject?: { id: string; name: string }; instructor?: { name: string }; _count?: { enrollments: number; modules: number } };
type PageResult = { data: Course[]; total: number };

export default function CoursesCataloguePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<PageResult>('courses?limit=100'), apiRequest<typeof subjects>('courses/subjects')])
      .then(([result, subjectList]) => { if (active) { setCourses(result.data || []); setSubjects(subjectList || []); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Course catalogue could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleCourses = useMemo(() => courses.filter((course) => {
    const matchesSubject = !subjectId || course.subject?.id === subjectId;
    const search = query.trim().toLowerCase();
    return matchesSubject && (!search || `${course.title} ${course.description} ${course.subject?.name || ''}`.toLowerCase().includes(search));
  }), [courses, query, subjectId]);

  return <main className="page-container space-y-6 py-9">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Published courses</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Training catalogue</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Browse courses currently published in this Capacity Connect instance. Course and instructor details are supplied by its training team.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative"><span className="sr-only">Search courses</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="field pl-9 text-sm" placeholder="Search courses" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span className="sr-only">Filter by subject</span><select className="field text-sm" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      </div>
    </header>
    {loading ? <p className="py-12 text-center text-sm text-slate-600">Loading published courses…</p> : error ? <p role="alert" className="surface p-5 text-sm text-rose-800">{error}</p> : visibleCourses.length === 0 ? <section className="surface p-8 text-center"><BookOpen className="mx-auto h-7 w-7 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-900">No matching courses</h2><p className="mt-1 text-sm text-slate-600">Try another search or check back when a course is published.</p></section> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visibleCourses.map((course) => <article key={course.id} className="surface flex flex-col p-5">
        <div className="flex-1"><p className="eyebrow">{course.subject?.name || 'Subject not recorded'}</p><h2 className="mt-2 text-lg font-semibold text-slate-950">{course.title}</h2><p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{course.description}</p>
          <p className="mt-4 text-xs text-slate-500">{course.level || 'Level not set'}{course.durationMins ? ` · ${course.durationMins} minutes` : ''}{course.instructor?.name ? ` · ${course.instructor.name}` : ''}</p></div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{course._count?.enrollments ?? 0} enrolled</span><span>{course._count?.modules ?? 0} modules</span></div>
        <Link href={`/courses/${course.id}`} className="button-primary mt-4 justify-center text-xs">View course <ArrowRight className="h-4 w-4" /></Link>
      </article>)}
    </div>}
  </main>;
}
