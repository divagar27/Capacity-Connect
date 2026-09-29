'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../lib/api';
import { Activity, BookOpen, CheckCircle2, CirclePlus, FileUp, Users, Video } from 'lucide-react';

type Subject = { id: string; name: string; code: string };
type Competency = { id: string; name: string; category: string; children?: Competency[] };
type QuestionSet = { id: string; title: string; deadline?: string | null; status: string; _count: { attempts: number; questions: number } };
type Course = { id: string; title: string; description: string; subjectId: string; subject: Subject; level: string; durationMins: number; capacity: number; status: string; prerequisites: string[]; learningObjectives: string[]; modules: { id: string; title: string; lessons: { id: string; title: string; durationMins: number }[] }[]; questionnaires: QuestionSet[]; _count: { enrollments: number }; competencies?: { targetLevel: number; competency: Competency }[] };
type Resource = { id: string; title: string; description?: string; resourceType: string; fileKey: string; fileSize?: number; mimeType?: string; createdAt: string; course?: { id: string; title: string } | null };
type TrainerStats = { courseCount: number; publishedCourseCount: number; pendingCourseCount: number; enrollmentCount: number; completionCount: number; completionRate: number; assessmentParticipation: number; averageAssessmentScore: number | null; courses: { id: string; title: string; status: string; enrollments: number; completions: number; assessmentAttempts: number }[] };
type User = { role: string; name: string; email: string };
type AssessmentAnalytics = { testTitle: string; totalAttempts: number; submittedCount: number; averageScore: number; passRate: number; weakTopics: { topic: string; accuracy: number }[] };

const emptyCourse = { title: '', description: '', subjectId: '', level: 'BEGINNER', durationMins: '120', capacity: '30', competencyId: '', targetLevel: '3', prerequisites: '', learningObjectives: '' };

export function TrainerWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [stats, setStats] = useState<TrainerStats | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [moduleTitle, setModuleTitle] = useState('');
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', durationMins: '20' });
  const [assessmentForm, setAssessmentForm] = useState({ title: '', prompt: '', topicTag: '', options: ['', '', ''], correctIndex: 0, deadline: '' });
  const [resourceForm, setResourceForm] = useState({ title: '', description: '', resourceType: 'STUDY_MATERIAL', visibility: 'ENROLLED', file: null as File | null });
  const [assessmentAnalytics, setAssessmentAnalytics] = useState<Record<string, AssessmentAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [session, myCourses, subjectList, taxonomy, analytics, myResources] = await Promise.all([
          apiRequest<{ user: User }>('me'),
          apiRequest<Course[]>('courses/trainer/my-courses'),
          apiRequest<Subject[]>('courses/subjects'),
          apiRequest<Competency[]>('profiles/skills/taxonomy'),
          apiRequest<TrainerStats>('courses/trainer/analytics'),
          apiRequest<Resource[]>('library'),
        ]);
        if (!active) return;
        if (session.user.role !== 'TRAINER') { router.replace('/portal'); return; }
        setUser(session.user);
        setCourses(myCourses);
        setSubjects(subjectList);
        setCompetencies(taxonomy.flatMap((item) => [item, ...(item.children || [])]));
        setStats(analytics);
        setResources(myResources);
        if (!selectedCourseId && myCourses.length) setSelectedCourseId(myCourses[0].id);
        setCourseForm((form) => ({ ...form, subjectId: form.subjectId || subjectList[0]?.id || '', competencyId: form.competencyId || taxonomy[0]?.id || '' }));
      } catch (loadError) {
        if (!active) return;
        if (typeof loadError === 'object' && loadError && 'status' in loadError && (loadError as {status:number}).status === 401) { router.replace('/auth/login'); return; }
        setError(loadError instanceof Error ? loadError.message : 'The trainer workspace could not be loaded.');
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [reload, router]);

  const selectedCourse = useMemo(() => courses.find((course) => course.id === selectedCourseId) || null, [courses, selectedCourseId]);
  const editableCourse = selectedCourse?.status === 'DRAFT';

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 5000); }
  async function submitForm(event: FormEvent, action: () => Promise<unknown>, successMessage: string) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try { await action(); flash(successMessage); setReload((value) => value + 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The request could not be completed.'); }
    finally { setSaving(false); }
  }

  async function createCourse(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const created = await apiRequest<Course>('courses', { method: 'POST', body: JSON.stringify({
        title: courseForm.title, description: courseForm.description, subjectId: courseForm.subjectId,
        level: courseForm.level, durationMins: Number(courseForm.durationMins), capacity: Number(courseForm.capacity),
        prerequisites: courseForm.prerequisites.split('\n').map((value) => value.trim()).filter(Boolean),
        learningObjectives: courseForm.learningObjectives.split('\n').map((value) => value.trim()).filter(Boolean),
        competencies: courseForm.competencyId ? [{ skillId: courseForm.competencyId, targetLevel: Number(courseForm.targetLevel) }] : [],
      }) });
      setCourseForm(emptyCourse);
      setSelectedCourseId(created.id);
      flash('Draft course created. Add a module and lesson before submitting it for review.');
      setReload((value) => value + 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Course creation failed.'); }
    finally { setSaving(false); }
  }

  async function addModule(event: FormEvent) {
    if (!selectedCourse) return;
    await submitForm(event, () => apiRequest(`courses/${selectedCourse.id}/modules`, { method: 'POST', body: JSON.stringify({ title: moduleTitle, order: selectedCourse.modules.length + 1 }) }), 'Module added to the draft course.');
    setModuleTitle('');
  }

  async function addLesson(event: FormEvent) {
    if (!selectedModuleId) { event.preventDefault(); setError('Choose a module for this lesson.'); return; }
    await submitForm(event, () => apiRequest(`courses/modules/${selectedModuleId}/lessons`, { method: 'POST', body: JSON.stringify({ title: lessonForm.title, content: lessonForm.content, durationMins: Number(lessonForm.durationMins) }) }), 'Lesson added. Its text is available to enrolled trainees in the course.');
    setLessonForm({ title: '', content: '', durationMins: '20' });
  }

  async function createAssessment(event: FormEvent) {
    if (!selectedCourse) { event.preventDefault(); setError('Choose a course first.'); return; }
    await submitForm(event, () => apiRequest('tests', { method: 'POST', body: JSON.stringify({
      title: assessmentForm.title, courseId: selectedCourse.id, subjectId: selectedCourse.subjectId,
      durationMins: 20, passMark: 60, deadline: assessmentForm.deadline || undefined,
      questions: [{ prompt: assessmentForm.prompt, topicTag: assessmentForm.topicTag || selectedCourse.subject.name,
        options: assessmentForm.options.map((text, index) => ({ text, isCorrect: index === assessmentForm.correctIndex })) }],
    }) }), 'Questionnaire created and linked to the selected course.');
    setAssessmentForm({ title: '', prompt: '', topicTag: '', options: ['', '', ''], correctIndex: 0, deadline: '' });
  }

  async function uploadResource(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourse || !resourceForm.file) { setError('Choose a course and a file to upload.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const upload = new FormData(); upload.append('file', resourceForm.file);
      const stored = await apiRequest<{ objectKey: string; size: number }>('media/upload', { method: 'POST', body: upload });
      await apiRequest('library/confirm', { method: 'POST', body: JSON.stringify({
        title: resourceForm.title, description: resourceForm.description, subjectId: selectedCourse.subjectId,
        courseId: selectedCourse.id, resourceType: resourceForm.resourceType,
        visibility: resourceForm.visibility, tags: [selectedCourse.subject.name],
        fileKey: stored.objectKey, fileSize: stored.size, mimeType: resourceForm.file.type,
      }) });
      setResourceForm({ title: '', description: '', resourceType: 'STUDY_MATERIAL', visibility: 'ENROLLED', file: null });
      flash('Resource uploaded and added to the library.'); setReload((value) => value + 1);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'The resource could not be uploaded. Check that object storage is running.'); }
    finally { setSaving(false); }
  }

  async function submitCourse() {
    if (!selectedCourse) return;
    setSaving(true); setError(''); setNotice('');
    try { await apiRequest(`courses/${selectedCourse.id}/submit`, { method: 'PATCH' }); flash('Course submitted for administrator review.'); setReload((value) => value + 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Course submission failed.'); }
    finally { setSaving(false); }
  }

  async function openResource(resource: Resource) {
    setError('');
    try { const result = await apiRequest<{ url: string }>(`library/${resource.id}/stream-url`); window.location.assign(result.url); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Resource access is unavailable.'); }
  }

  async function viewAssessmentResults(id: string) {
    setError('');
    try { const result = await apiRequest<AssessmentAnalytics>(`tests/${id}/analytics`); setAssessmentAnalytics((current) => ({ ...current, [id]: result })); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Assessment results are unavailable.'); }
  }

  if (loading) return <div className="page-container py-16 text-center text-sm text-slate-600">Loading trainer workspace…</div>;
  if (error && !user) return <div className="page-container py-12"><div role="alert" className="max-w-2xl border border-rose-200 bg-white p-5"><h1 className="font-semibold">Trainer workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={() => setReload((value) => value + 1)} className="button-secondary mt-4 text-xs">Try again</button></div></div>;

  return (
    <div className="page-container space-y-7 py-8 sm:py-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Trainer workspace{user?.email.endsWith('.demo.local') ? ' · Sample records' : ''}</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Training programmes and outcomes</h1><p className="mt-2 text-sm text-slate-600">Create course material, schedule a questionnaire, and review actual participation.</p></div><Link href="/profile" className="text-xs font-semibold text-gov-accent hover:underline">Trainer profile</Link></header>
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Trainer analytics">
        {[
          ['Training programmes', stats?.courseCount ?? 0], ['Published', stats?.publishedCourseCount ?? 0],
          ['Trainee enrolments', stats?.enrollmentCount ?? 0], ['Completion rate', `${stats?.completionRate ?? 0}%`],
        ].map(([label, value]) => <div key={String(label)} className="surface p-4"><span className="eyebrow">{label}</span><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>)}
      </section>
      <section className="grid gap-3 sm:grid-cols-2"><div className="surface flex items-center gap-3 p-4"><Users className="h-5 w-5 text-gov-accent" /><div><p className="text-xs font-semibold text-slate-900">Assessment participation</p><p className="mt-1 text-[11px] text-slate-600">{stats?.assessmentParticipation ?? 0} recorded attempts · average score {stats?.averageAssessmentScore == null ? 'not available' : `${stats.averageAssessmentScore}%`}</p></div></div><div className="surface flex items-center gap-3 p-4"><Activity className="h-5 w-5 text-gov-accent" /><div><p className="text-xs font-semibold text-slate-900">Completion</p><p className="mt-1 text-[11px] text-slate-600">{stats?.completionCount ?? 0} course completions recorded across your programmes.</p></div></div></section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="surface p-5"><div className="flex items-center gap-2"><CirclePlus className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Create a course draft</h2></div><p className="mt-2 text-xs leading-5 text-slate-600">Add the subject, intended level, competency target, prerequisites, and outcomes. A draft is not visible in the public catalogue until an administrator approves it.</p>
            <form className="mt-4 space-y-3" onSubmit={createCourse}>
              <div><label className="field-label" htmlFor="course-title">Course title</label><input id="course-title" required className="field" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></div>
              <div><label className="field-label" htmlFor="course-description">Description</label><textarea id="course-description" required rows={3} className="field" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="course-subject">Subject</label><select id="course-subject" required className="field" value={courseForm.subjectId} onChange={(event) => setCourseForm({ ...courseForm, subjectId: event.target.value })}><option value="">Choose a subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div><label className="field-label" htmlFor="course-level">Level</label><select id="course-level" className="field" value={courseForm.level} onChange={(event) => setCourseForm({ ...courseForm, level: event.target.value })}>{['BEGINNER','INTERMEDIATE','ADVANCED'].map((level) => <option key={level}>{level}</option>)}</select></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="course-duration">Duration (minutes)</label><input id="course-duration" type="number" min="1" className="field" value={courseForm.durationMins} onChange={(event) => setCourseForm({ ...courseForm, durationMins: event.target.value })} /></div><div><label className="field-label" htmlFor="course-capacity">Capacity</label><input id="course-capacity" type="number" min="1" className="field" value={courseForm.capacity} onChange={(event) => setCourseForm({ ...courseForm, capacity: event.target.value })} /></div></div>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]"><div><label className="field-label" htmlFor="course-competency">Competency mapped</label><select id="course-competency" className="field" value={courseForm.competencyId} onChange={(event) => setCourseForm({ ...courseForm, competencyId: event.target.value })}><option value="">No mapping</option>{competencies.map((competency) => <option key={competency.id} value={competency.id}>{competency.name}</option>)}</select></div><div><label className="field-label" htmlFor="target-level">Target level</label><input id="target-level" type="number" min="1" max="5" className="field" value={courseForm.targetLevel} onChange={(event) => setCourseForm({ ...courseForm, targetLevel: event.target.value })} /></div></div>
              <div><label className="field-label" htmlFor="course-prerequisites">Prerequisites · one per line</label><textarea id="course-prerequisites" rows={2} className="field" value={courseForm.prerequisites} onChange={(event) => setCourseForm({ ...courseForm, prerequisites: event.target.value })} /></div>
              <div><label className="field-label" htmlFor="course-objectives">Learning objectives · one per line</label><textarea id="course-objectives" rows={2} className="field" value={courseForm.learningObjectives} onChange={(event) => setCourseForm({ ...courseForm, learningObjectives: event.target.value })} /></div>
              <button disabled={saving || subjects.length === 0} className="button-primary w-full text-xs">{saving ? 'Creating…' : 'Create draft course'}</button>
            </form>
          </section>

          <section className="surface p-5"><div className="flex items-center gap-2"><FileUp className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Add a learning resource</h2></div><p className="mt-2 text-xs text-slate-600">PDF, PowerPoint, and MP4 files up to 50 MB. Local uploads require the configured object store.</p>
            <form className="mt-4 space-y-3" onSubmit={uploadResource}>
              <div><label className="field-label" htmlFor="resource-course">Course</label><select id="resource-course" required className="field" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}><option value="">Choose a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div>
              <div><label className="field-label" htmlFor="resource-title">Resource title</label><input id="resource-title" required className="field" value={resourceForm.title} onChange={(event) => setResourceForm({ ...resourceForm, title: event.target.value })} /></div>
              <div><label className="field-label" htmlFor="resource-description">Description</label><input id="resource-description" className="field" value={resourceForm.description} onChange={(event) => setResourceForm({ ...resourceForm, description: event.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><label className="field-label" htmlFor="resource-type">Resource type</label><select id="resource-type" className="field" value={resourceForm.resourceType} onChange={(event) => setResourceForm({ ...resourceForm, resourceType: event.target.value })}>{[['RECORDED_LECTURE','Recorded lecture'],['PRESENTATION','Presentation'],['STUDY_MATERIAL','Study material'],['REFERENCE_DOCUMENT','Reference document']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="field-label" htmlFor="resource-visibility">Visibility</label><select id="resource-visibility" className="field" value={resourceForm.visibility} onChange={(event) => setResourceForm({ ...resourceForm, visibility: event.target.value })}><option value="ENROLLED">Enrolled trainees</option><option value="PUBLIC">Public</option><option value="PRIVATE">Trainer only</option></select></div></div>
              <div><label className="field-label" htmlFor="resource-file">File</label><input id="resource-file" required type="file" accept="video/mp4,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png" className="field text-xs" onChange={(event) => setResourceForm({ ...resourceForm, file: event.target.files?.[0] || null })} /></div>
              <button disabled={saving || !selectedCourse} className="button-secondary w-full text-xs">{saving ? 'Uploading…' : 'Upload and add to library'}</button>
            </form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Course management</p><h2 className="mt-1 text-lg font-semibold text-slate-900">My programmes</h2></div><span className="text-[11px] text-slate-500">{courses.length} records</span></div>
            {courses.length ? <div className="mt-4 space-y-3">{courses.map((course) => <button key={course.id} type="button" onClick={() => setSelectedCourseId(course.id)} className={`w-full rounded-md border p-4 text-left transition-colors ${course.id === selectedCourseId ? 'border-gov-blue bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{course.subject.name} · {course.status}</span><span className="text-[11px] text-slate-600">{course._count?.enrollments || 0} enrolled</span></span><span className="mt-1 block text-sm font-semibold text-slate-900">{course.title}</span><span className="mt-1 block text-xs text-slate-600">{course.modules.length} modules · {course.questionnaires.length} questionnaires</span>
            </button>)}</div> : <div className="mt-4 rounded border border-dashed border-slate-300 p-5 text-xs text-slate-600">You have not created a course yet. Start with a draft on the left.</div>}
          </section>

          {selectedCourse && <section className="surface p-5"><div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">{selectedCourse.status} · {selectedCourse.subject.name}</p><h2 className="mt-1 text-base font-semibold text-slate-900">{selectedCourse.title}</h2><p className="mt-1 text-xs text-slate-600">{selectedCourse.description}</p></div>{editableCourse ? <button type="button" disabled={saving || !selectedCourse.modules.length} onClick={submitCourse} className="button-primary shrink-0 text-[11px]">Submit for review</button> : <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{selectedCourse.status === 'SUBMITTED' ? 'Awaiting admin review' : 'Published course'}</span>}</div>
            {editableCourse && <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <form onSubmit={addModule} className="space-y-3"><h3 className="text-xs font-semibold text-slate-900">Add module</h3><div><label htmlFor="module-title" className="field-label">Module title</label><input id="module-title" required className="field" value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} /></div><button disabled={saving} className="button-secondary w-full text-xs">Add module</button></form>
              <form onSubmit={addLesson} className="space-y-3"><h3 className="text-xs font-semibold text-slate-900">Add lesson</h3><div><label htmlFor="lesson-module" className="field-label">Module</label><select id="lesson-module" className="field" value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)}><option value="">Choose a module</option>{selectedCourse.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></div><div><label htmlFor="lesson-title" className="field-label">Lesson title</label><input id="lesson-title" required className="field" value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })} /></div><div><label htmlFor="lesson-content" className="field-label">Learning material</label><textarea id="lesson-content" rows={3} className="field" value={lessonForm.content} onChange={(event) => setLessonForm({ ...lessonForm, content: event.target.value })} /></div><button disabled={saving || !selectedCourse.modules.length} className="button-secondary w-full text-xs">Add lesson</button></form>
            </div>}
            <div className="mt-4 space-y-3">{selectedCourse.modules.map((module) => <div key={module.id} className="border-t border-slate-200 pt-3"><h3 className="text-xs font-semibold text-slate-800">{module.title}</h3><ul className="mt-2 space-y-1">{module.lessons.map((lesson) => <li key={lesson.id} className="text-[11px] text-slate-600">{lesson.title} · {lesson.durationMins || 'Self-paced'} min</li>)}</ul></div>)}</div>
          </section>}

          {selectedCourse?.status === 'PUBLISHED' && <section className="surface p-5"><div className="flex items-center gap-2"><CirclePlus className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Create a questionnaire</h2></div><form className="mt-4 space-y-3" onSubmit={createAssessment}>
            <div><label htmlFor="assessment-title" className="field-label">Questionnaire title</label><input id="assessment-title" required className="field" value={assessmentForm.title} onChange={(event) => setAssessmentForm({ ...assessmentForm, title: event.target.value })} /></div>
            <div><label htmlFor="assessment-deadline" className="field-label">Deadline (optional)</label><input id="assessment-deadline" type="datetime-local" className="field" value={assessmentForm.deadline} onChange={(event) => setAssessmentForm({ ...assessmentForm, deadline: event.target.value })} /></div>
            <div><label htmlFor="assessment-prompt" className="field-label">Question</label><textarea id="assessment-prompt" required rows={2} className="field" value={assessmentForm.prompt} onChange={(event) => setAssessmentForm({ ...assessmentForm, prompt: event.target.value })} /></div>
            <div><label htmlFor="assessment-topic" className="field-label">Competency area</label><input id="assessment-topic" className="field" placeholder={selectedCourse.subject.name} value={assessmentForm.topicTag} onChange={(event) => setAssessmentForm({ ...assessmentForm, topicTag: event.target.value })} /></div>
            {assessmentForm.options.map((option, index) => <div key={index}><label htmlFor={`assessment-option-${index}`} className="field-label">Option {index + 1} {assessmentForm.correctIndex === index ? '· correct answer' : ''}</label><div className="flex gap-2"><input id={`assessment-option-${index}`} required className="field" value={option} onChange={(event) => setAssessmentForm({ ...assessmentForm, options: assessmentForm.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) })} /><button type="button" aria-label={`Mark option ${index + 1} as correct`} aria-pressed={assessmentForm.correctIndex === index} onClick={() => setAssessmentForm({ ...assessmentForm, correctIndex: index })} className={`rounded border px-3 text-xs ${assessmentForm.correctIndex === index ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-600'}`}>Correct</button></div></div>)}
            <button disabled={saving} className="button-primary w-full text-xs">Create timed assessment</button>
          </form></section>}

          {selectedCourse && <section className="surface p-5"><div className="flex items-center gap-2"><Video className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Learning resources</h2></div>{resources.filter((resource) => resource.course?.id === selectedCourse.id).length ? <ul className="mt-3 divide-y divide-slate-200">{resources.filter((resource) => resource.course?.id === selectedCourse.id).map((resource) => <li key={resource.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-semibold text-slate-900">{resource.title}</p><p className="mt-1 text-[10px] text-slate-500">{resource.resourceType.replaceAll('_', ' ')} · {new Date(resource.createdAt).toLocaleDateString()}</p></div><button type="button" className="text-xs font-semibold text-gov-accent hover:underline" onClick={() => openResource(resource)}>Open</button></li>)}</ul> : <p className="mt-3 text-xs text-slate-600">No uploaded resources are attached to this course yet.</p>}</section>}

          {selectedCourse?.questionnaires?.length ? <section className="surface p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Questionnaires and participation</h2></div><ul className="mt-3 space-y-3">{selectedCourse.questionnaires.map((test) => <li key={test.id} className="border-t border-slate-200 pt-3 first:border-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-900">{test.title}</p><p className="mt-1 text-[11px] text-slate-600">{test._count.attempts} attempts · {test._count.questions} questions</p></div><button type="button" onClick={() => viewAssessmentResults(test.id)} className="button-secondary text-[11px]">View results</button></div>{assessmentAnalytics[test.id] && <div className="mt-3 grid gap-2 rounded bg-slate-50 p-3 text-[11px] sm:grid-cols-3"><p>Submitted: {assessmentAnalytics[test.id].submittedCount}/{assessmentAnalytics[test.id].totalAttempts}</p><p>Mean score: {assessmentAnalytics[test.id].averageScore}%</p><p>Pass rate: {assessmentAnalytics[test.id].passRate}%</p></div>}</li>)}</ul></section> : null}
        </div>
      </section>
    </div>
  );
}
