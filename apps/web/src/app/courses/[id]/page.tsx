'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, Circle, Clock3, GraduationCap, RefreshCw } from 'lucide-react';
import { apiRequest, ApiError } from '../../../lib/api';

type Lesson = { id: string; title: string; content?: string | null; durationMins?: number };
type Course = { id: string; title: string; description: string; level: string; durationMins?: number; prerequisites?: string[]; learningObjectives?: string[]; subject?: { name: string }; instructor?: { name: string }; competencies?: { competency: { name: string; category: string }; targetLevel: number }[]; modules: { id: string; title: string; lessons: Lesson[] }[]; questionnaires?: { id: string; title: string; durationMins: number; _count?: { questions: number } }[] };
type Enrollment = { course: { id: string }; lessonProgress?: string[]; progress: number };
type Resource = { id: string; title: string; description?: string | null; resourceType: string; mimeType?: string | null };

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params.id;
  const [course, setCourse] = useState<Course | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const item = await apiRequest<Course>(`courses/${courseId}`);
      setCourse(item);
      try {
        const enrollments = await apiRequest<Enrollment[]>('courses/trainee/my-enrollments');
        const current = enrollments.find((entry) => entry.course.id === courseId);
        setEnrolled(Boolean(current)); setCompleted(current?.lessonProgress || []); setProgress(current?.progress || 0);
      } catch (reason) { if (!(reason instanceof ApiError && [401, 403].includes(reason.status))) throw reason; }
      try { setResources(await apiRequest<Resource[]>(`library?courseId=${encodeURIComponent(courseId)}`)); }
      catch (reason) { if (!(reason instanceof ApiError && reason.status === 401)) throw reason; }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Course details could not be loaded.'); }
    finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  const lessonTotal = useMemo(() => course?.modules.reduce((total, module) => total + module.lessons.length, 0) || 0, [course]);
  async function enroll() {
    setBusy(true); setError(''); setNotice('');
    try { await apiRequest(`courses/${courseId}/enroll`, { method: 'POST' }); setEnrolled(true); setNotice('You are enrolled. Your course progress will update as you complete lessons.'); await load(); }
    catch (reason) { if (reason instanceof ApiError && reason.status === 401) { router.push(`/auth/login?redirect=/courses/${courseId}`); return; } setError(reason instanceof Error ? reason.message : 'Enrollment could not be completed.'); }
    finally { setBusy(false); }
  }
  async function completeLesson(lessonId: string) {
    setBusy(true); setError('');
    try { const result = await apiRequest<{ progress: number; lessonProgress?: string[] }>(`courses/${courseId}/lessons/${lessonId}/progress`, { method: 'POST' }); setProgress(result.progress); setCompleted(result.lessonProgress || [...completed, lessonId]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Lesson progress could not be saved.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="page-container py-16 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading course…</main>;
  if (!course) return <main className="page-container py-12"><section role="alert" className="surface mx-auto max-w-xl p-6 text-center"><AlertCircle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 font-semibold">Course unavailable</h1><p className="mt-2 text-sm text-slate-600">{error || 'This course is not published or could not be found.'}</p><Link href="/courses" className="button-secondary mt-4 text-xs"><ArrowLeft className="h-4 w-4" />Course catalogue</Link></section></main>;
  return <main className="page-container space-y-6 py-8">
    <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-gov-blue hover:underline"><ArrowLeft className="h-4 w-4" />Course catalogue</Link>
    <section className="surface grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_18rem]">
      <div><p className="eyebrow">{course.subject?.name || 'Subject not recorded'} · {course.level || 'Level not set'}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{course.title}</h1><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{course.description}</p>
        <p className="mt-4 text-xs text-slate-500">{course.instructor?.name ? `Trainer: ${course.instructor.name}` : 'Trainer not recorded'}{course.durationMins ? ` · ${course.durationMins} minutes` : ''} · {lessonTotal} lessons</p>
        {course.learningObjectives?.length ? <div className="mt-5"><h2 className="text-sm font-semibold">Learning objectives</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{course.learningObjectives.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
        {course.competencies?.length ? <div className="mt-5"><h2 className="text-sm font-semibold">Competencies covered</h2><div className="mt-2 flex flex-wrap gap-2">{course.competencies.map((item) => <span key={item.competency.name} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-900">{item.competency.name} · target {item.targetLevel}/5</span>)}</div></div> : null}
        {course.prerequisites?.length ? <p className="mt-5 text-sm text-slate-600"><strong>Prerequisites:</strong> {course.prerequisites.join(', ')}</p> : null}
      </div>
      <aside className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="eyebrow">Your enrollment</p>{enrolled ? <><p className="mt-2 text-sm font-semibold text-emerald-800">Enrolled · {progress}% complete</p><div className="mt-3 h-2 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} /></div></> : <><p className="mt-2 text-sm text-slate-600">Sign in as a trainee to enroll and track lesson progress.</p><button type="button" className="button-primary mt-4 w-full justify-center text-xs" onClick={enroll} disabled={busy}>{busy ? 'Enrolling…' : 'Enroll in course'}</button></>}{notice ? <p role="status" className="mt-3 text-xs text-emerald-800">{notice}</p> : null}</aside>
    </section>
    {error && course ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {resources.length ? <section className="surface p-5 sm:p-7"><h2 className="text-lg font-semibold">Course resources</h2><ul className="mt-3 divide-y divide-slate-100">{resources.map((resource) => <li key={resource.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{resource.title}</p><p className="mt-1 text-xs text-slate-500">{resource.resourceType.replaceAll('_', ' ')}{resource.mimeType ? ` · ${resource.mimeType}` : ''}{resource.description ? ` · ${resource.description}` : ''}</p></div><button type="button" className="button-secondary text-xs" onClick={async () => { try { const result = await apiRequest<{ url: string }>(`library/${resource.id}/stream-url`); window.location.assign(result.url); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Resource is unavailable.'); } }}>Open resource</button></li>)}</ul></section> : null}
    <section className="surface p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 text-gov-blue" />Course content</h2>
      {course.modules.length ? <div className="mt-5 space-y-4">{course.modules.map((module, index) => <article key={module.id} className="rounded-md border border-slate-200"><header className="flex items-center justify-between bg-slate-50 px-4 py-3"><h3 className="text-sm font-semibold">{index + 1}. {module.title}</h3><span className="text-xs text-slate-500">{module.lessons.length} lessons</span></header><div className="divide-y divide-slate-100">{module.lessons.map((lesson) => <div key={lesson.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-start"><div><div className="flex items-center gap-2 text-sm font-medium">{completed.includes(lesson.id) ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Circle className="h-4 w-4 text-slate-400" />}{lesson.title}</div>{lesson.content ? <p className="mt-2 whitespace-pre-line pl-6 text-sm leading-6 text-slate-600">{lesson.content}</p> : <p className="mt-2 pl-6 text-xs text-slate-500">Lesson content has not been added.</p>}{lesson.durationMins ? <p className="mt-2 flex items-center gap-1 pl-6 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{lesson.durationMins} minutes</p> : null}</div>{enrolled && !completed.includes(lesson.id) ? <button type="button" disabled={busy} className="button-secondary text-xs" onClick={() => completeLesson(lesson.id)}>Mark complete</button> : null}</div>)}</div></article>)}</div> : <p className="mt-4 text-sm text-slate-600">No modules have been added to this course yet.</p>}
    </section>
    {course.questionnaires?.length ? <section className="surface p-5 sm:p-7"><h2 className="flex items-center gap-2 text-lg font-semibold"><GraduationCap className="h-5 w-5 text-gov-blue" />Assessments</h2><ul className="mt-4 divide-y divide-slate-100">{course.questionnaires.map((assessment) => <li key={assessment.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{assessment.title}</p><p className="mt-1 text-xs text-slate-500">{assessment._count?.questions ?? 0} questions · {assessment.durationMins} minutes</p></div><Link className="button-secondary text-xs" href={`/tests/${assessment.id}`}>Open assessment</Link></li>)}</ul></section> : null}
  </main>;
}
