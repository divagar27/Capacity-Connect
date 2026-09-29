'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Compass, FileText, LockKeyhole } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Course = { id: string; title: string; description: string; level: string; subject?: { name: string } };
type Announcement = { id: string; title: string; content: string; type: string; publishAt: string; pinned: boolean };

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiRequest<{ data: Course[] }>('courses?limit=3'),
      apiRequest<Announcement[]>('public/announcements'),
    ]).then(([catalogue, notices]) => {
      if (!active) return;
      if (catalogue.status === 'fulfilled') setCourses(catalogue.value.data || []);
      else setLoadError(true);
      if (notices.status === 'fulfilled') setAnnouncements(notices.value || []);
      else setLoadError(true);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="pb-14">
      <section className="border-b border-slate-200 bg-white">
        <div className="page-container grid gap-10 py-12 md:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)] md:items-center md:py-16">
          <div className="max-w-3xl">
            <p className="eyebrow">Prototype for MoES / IMD capacity-building</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              CAPACITY CONNECT
              <span className="mt-2 block text-xl font-medium leading-snug text-slate-700 sm:text-2xl">Digital Capacity Building &amp; Learning Management Platform</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-600">
              Connect professional competencies with relevant training, assessments, and learning resources. Track what you have built and identify a practical next step.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/auth/login" className="button-primary">Open the learning portal <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/courses" className="button-secondary">Browse learning catalogue <BookOpen className="h-4 w-4" /></Link>
            </div>
            <p className="mt-4 text-[11px] text-slate-500">Prototype environment · Courses and profiles marked as sample are demonstration records.</p>
          </div>

          <aside className="rounded-md border border-slate-200 bg-slate-50 p-5" aria-labelledby="how-it-works">
            <h2 id="how-it-works" className="text-sm font-semibold text-slate-900">A learning cycle connected to role needs</h2>
            <ol className="mt-4 space-y-3">
              {[
                ['01', 'Discover', 'Review your profile and competency map.'],
                ['02', 'Learn', 'Follow courses matched to a development need.'],
                ['03', 'Assess', 'Apply learning through a subject assessment.'],
                ['04', 'Build competency', 'Record progress and certification eligibility.'],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-3 border-t border-slate-200 pt-3 first:border-0 first:pt-0">
                  <span className="mt-0.5 font-mono text-[11px] text-gov-accent">{number}</span>
                  <div><h3 className="text-xs font-semibold text-slate-800">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{description}</p></div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="page-container py-10">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Learning areas</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Training linked to professional practice</h2></div>
          <Link href="/courses" className="inline-flex items-center gap-1 text-xs font-semibold text-gov-accent hover:underline">View catalogue <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ['Weather and climate data', 'Quality review, analysis, interpretation, and forecast verification.'],
            ['Observation and remote sensing', 'Use radar and satellite products alongside other observations.'],
            ['Risk and communication', 'Connect hazard information to clear, accessible public guidance.'],
          ].map(([title, description]) => (
            <article key={title} className="border-l-2 border-gov-blue pl-4 py-1">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="page-container grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Learning catalogue</h2></div>
            {loadError ? (
              <p role="status" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">The catalogue is temporarily unavailable. Try again from the course catalogue when the service is running.</p>
            ) : courses.length ? (
              <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">
                {courses.map((course) => (
                  <li key={course.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{course.subject?.name || 'Learning area'} · {course.level}</span><h3 className="mt-1 text-sm font-semibold text-slate-900">{course.title}</h3></div>
                    <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-gov-accent hover:underline">Course details <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-600">No published courses are available yet. Sample course records appear here after demo data is seeded.</p>}
          </div>

          <div>
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Announcements</h2></div>
            {announcements.length ? (
              <ul className="mt-4 space-y-3">
                {announcements.slice(0, 4).map((notice) => (
                  <li key={notice.id} className="border-b border-slate-200 pb-3">
                    <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{notice.type.replace('_', ' ')}</span><time className="text-[10px] text-slate-500">{new Date(notice.publishAt).toLocaleDateString()}</time></div>
                    <h3 className="mt-1 text-xs font-semibold text-slate-900">{notice.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{notice.content}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-600">{loadError ? 'Announcements are temporarily unavailable.' : 'There are no published announcements.'}</p>}
          </div>
        </div>
      </section>

      <section className="page-container py-10">
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><h3 className="text-xs font-semibold text-slate-900">Role-based workspaces</h3><p className="mt-1 text-xs leading-5 text-slate-600">Trainees, trainers, and administrators see tools for their responsibilities.</p></div></div>
          <div className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-gov-accent" /><div><h3 className="text-xs font-semibold text-slate-900">Controlled access</h3><p className="mt-1 text-xs leading-5 text-slate-600">Protected actions and records are checked by the API.</p></div></div>
          <div className="flex gap-3"><BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" /><div><h3 className="text-xs font-semibold text-slate-900">Explainable learning paths</h3><p className="mt-1 text-xs leading-5 text-slate-600">Recommendations follow saved proficiency levels and explicit course mappings.</p></div></div>
        </div>
      </section>
    </div>
  );
}
