'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';
import { ArrowRight, Award, BookOpen, CalendarClock, CheckCircle2, CircleHelp, RefreshCw, UserRound } from 'lucide-react';

type Skill = { id: string; proficiency: number; targetProficiency?: number | null; skill: { id: string; name: string; category: string } };
type Lesson = { id: string; title: string; content?: string | null; durationMins: number };
type Course = { id: string; title: string; description: string; subject: { name: string }; instructor: { name: string }; modules: { id: string; title: string; lessons: Lesson[] }[]; questionnaires?: { id: string; title: string }[] };
type Enrollment = { id: string; status: string; progress: number; lessonProgress?: string[] | null; certificate?: { serialNumber: string; issueDate: string } | null; course: Course };
type Gap = { competencyId: string; competency: string; category: string; currentLevel: number; targetLevel: number; gap: number; pathway: { courseId: string; title: string; description: string; subject: string; level: string; durationMins: number; prerequisites: string[]; targetLevel: number; trainer: { name: string; designation?: string }; assessment: { id: string; title: string; deadline?: string | null } | null; enrollment: { id: string; progress: number } | null; reason: string }[] };
type Assessment = { id: string; title: string; courseId?: string | null; course?: { id: string; title: string } | null; subject: { name: string }; deadline?: string | null; _count: { questions: number; attempts: number } };
type Attempt = { id: string; status: string; score?: number | null; isPassed?: boolean | null; questionnaire: { id: string; title: string; courseId?: string | null; course?: { title: string } | null } };
type DemoUser = { id: string; name: string; email: string; role: string; department?: string; designation?: string; employeeId?: string; phone?: string };
type Profile = DemoUser & { qualifications: unknown[]; workExperiences: unknown[]; userSkills: Skill[]; certificates: unknown[] };
type Notice = { id: string; title: string; content: string; type: string; publishAt: string };

export function TraineeWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyCertificate, setBusyCertificate] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [session, myProfile, myLearning, learningPath, testList, myAttempts, announcements] = await Promise.all([
          apiRequest<{ user: DemoUser }>('me'),
          apiRequest<Profile>('profiles/me'),
          apiRequest<Enrollment[]>('courses/trainee/my-enrollments'),
          apiRequest<Gap[]>('competency/learning-path'),
          apiRequest<Assessment[]>('tests'),
          apiRequest<Attempt[]>('tests/my-attempts'),
          apiRequest<Notice[]>('public/announcements'),
        ]);
        if (!active) return;
        if (session.user.role !== 'TRAINEE') { router.replace('/portal'); return; }
        setUser(session.user);
        setProfile(myProfile);
        setEnrollments(myLearning);
        setGaps(learningPath);
        setAssessments(testList);
        setAttempts(myAttempts);
        setNotices(announcements);
      } catch (loadError) {
        if (!active) return;
        if ('status' in (loadError as object) && (loadError as { status: number }).status === 401) {
          router.replace('/auth/login');
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'The learning workspace could not be loaded.');
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [reload, router]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const fields = [profile.name, profile.employeeId, profile.department, profile.designation, profile.phone,
      profile.qualifications.length, profile.workExperiences.length, profile.userSkills.length, profile.certificates.length];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);
  const totalProgress = enrollments.length
    ? Math.round(enrollments.reduce((sum, item) => sum + item.progress, 0) / enrollments.length)
    : 0;
  const enrolledCourseIds = new Set(enrollments.map((item) => item.course.id));
  const relevantAssessments = assessments.filter((assessment) => !assessment.courseId || enrolledCourseIds.has(assessment.courseId));

  async function issueCertificate(enrollment: Enrollment) {
    setBusyCertificate(enrollment.id);
    setFeedback('');
    try {
      await apiRequest(`certificates/issue/${enrollment.id}`, { method: 'POST' });
      setFeedback(`Certificate issued for ${enrollment.course.title}.`);
      setReload((value) => value + 1);
    } catch (issueError) {
      setFeedback(issueError instanceof Error ? issueError.message : 'Certificate eligibility could not be confirmed.');
    } finally { setBusyCertificate(null); }
  }

  if (loading) return <div className="page-container py-16 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading your learning profile…</div>;
  if (error) return <div className="page-container py-12"><div role="alert" className="max-w-2xl rounded-md border border-rose-200 bg-white p-5"><h1 className="font-semibold text-slate-900">Learning workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button type="button" className="button-secondary mt-4 text-xs" onClick={() => setReload((value) => value + 1)}>Try again</button></div></div>;
  if (!user || !profile) return null;

  const issuedCertificates = enrollments.filter((enrollment) => enrollment.certificate);
  const recentAttempts = attempts.slice(0, 3);
  const isDemoAccount = user.email.endsWith('.demo.local');

  return (
    <div className="page-container space-y-7 py-8 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Trainee workspace{isDemoAccount ? ' · Sample profile' : ''}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Welcome, {user.name.split(' (')[0]}</h1>
          <p className="mt-2 text-sm text-slate-600">Review your current learning, competency gaps, and the next relevant activity.</p>
          <p className="mt-1 text-[11px] text-slate-500">{user.department || 'Department not recorded'} · {user.designation || 'Designation not recorded'} · {user.employeeId || 'Employee ID not recorded'}</p>
        </div>
        <Link href="/profile" className="button-secondary text-xs"><UserRound className="h-4 w-4" />Review professional profile</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]" aria-label="Learning summary">
        <div className="surface p-4"><span className="eyebrow">Enrolled learning</span><p className="mt-2 text-2xl font-semibold text-slate-900">{enrollments.length}</p><p className="mt-1 text-xs text-slate-600">{totalProgress}% average course progress</p></div>
        <div className="surface p-4"><span className="eyebrow">Certificates</span><p className="mt-2 text-2xl font-semibold text-slate-900">{issuedCertificates.length}</p><p className="mt-1 text-xs text-slate-600">Issued against completed training</p></div>
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-4"><span className="eyebrow">Profile completion</span><Link href="/profile" className="text-[11px] font-semibold text-gov-accent hover:underline">Complete profile</Link></div>
          <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded bg-slate-100" role="progressbar" aria-label="Profile completion" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-gov-blue" style={{ width: `${completion}%` }} /></div><span className="text-xs font-semibold text-slate-700">{completion}%</span></div>
          <p className="mt-2 text-[11px] text-slate-500">Based on identity, qualifications, experience, skills, and certificates.</p>
        </div>
      </section>

      <section id="competency-map" className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Professional development</p><h2 className="mt-1 text-lg font-semibold text-slate-900">My competency map</h2></div><span className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">Recorded profile data</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-600">Proficiency levels are profile records and course mapping targets; they are not independently assessed professional standards.</p>
          {profile.userSkills.length ? <div className="mt-5 space-y-4">{profile.userSkills.map((item) => <div key={item.id}>
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-slate-900">{item.skill.name}</h3><p className="text-[11px] text-slate-500">{item.skill.category}</p></div><span className="whitespace-nowrap text-[11px] font-medium text-slate-700">Level {item.proficiency}/5{item.targetProficiency ? ` · target ${item.targetProficiency}` : ''}</span></div>
            <div className="mt-2 flex gap-1" aria-label={`${item.skill.name}, level ${item.proficiency} of 5`}>{[1,2,3,4,5].map((level) => <span key={level} className={`h-1.5 flex-1 rounded ${level <= item.proficiency ? 'bg-gov-blue' : 'bg-slate-100'}`} />)}</div>
          </div>)}</div> : <p className="mt-4 rounded border border-dashed border-slate-300 p-4 text-xs text-slate-600">No competencies are recorded yet. Add skills in your profile to see the map.</p>}
        </div>

        <div className="surface p-5">
          <div><p className="eyebrow">Deterministic recommendation</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Competency gap → learning path</h2></div>
          {gaps.length ? <div className="mt-4 space-y-5">{gaps.map((gap) => <article key={gap.competencyId} className="border-t border-slate-200 pt-4 first:border-0 first:pt-0">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold text-slate-900">{gap.competency}</h3><p className="mt-1 text-xs text-slate-600">Current level {gap.currentLevel} · target {gap.targetLevel}</p></div><span className="rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">Gap {gap.gap}</span></div>
            {gap.pathway.length ? <ol className="mt-4 space-y-3">{gap.pathway.map((course, index) => <li key={course.courseId} className="relative border-l border-slate-300 pl-4">
              <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-gov-blue" />
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Step {index + 1} · Level {course.targetLevel}</p><Link href={`/courses/${course.courseId}`} className="mt-1 block text-xs font-semibold text-gov-accent hover:underline">{course.title}</Link><p className="mt-1 text-[11px] leading-5 text-slate-600">{course.reason}</p><p className="mt-1 text-[10px] text-slate-500">{course.trainer.name} · {Math.ceil(course.durationMins / 60)} hours · {course.assessment ? 'Assessment available' : 'Assessment not listed'}</p></div><Link href={`/courses/${course.courseId}`} aria-label={`${course.enrollment ? 'Continue' : 'View'} ${course.title}`} className="shrink-0 rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><ArrowRight className="h-4 w-4" /></Link></div>
            </li>)}</ol> : <p className="mt-3 text-xs text-slate-600">No published courses are mapped to this gap yet. Check back after a trainer publishes relevant learning.</p>}
          </article>)}</div> : <div className="mt-4 rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-xs leading-5 text-slate-600">No competency gaps are recorded. Add a current and target level to your profile to build a pathway.</div>}
          <p className="mt-4 border-t border-slate-200 pt-3 text-[10px] leading-4 text-slate-500">Courses are matched by competency ID and ordered by the proficiency level they support. No generated recommendations are used.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Enrolled courses</p><h2 className="mt-1 text-lg font-semibold text-slate-900">My learning</h2></div><Link href="/courses" className="text-xs font-semibold text-gov-accent hover:underline">Find a course</Link></div>
          {enrollments.length ? <div className="mt-4 divide-y divide-slate-200">{enrollments.map((enrollment) => <article key={enrollment.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{enrollment.course.subject.name} · {enrollment.status.replace('_', ' ')}</span><h3 className="mt-1 text-sm font-semibold text-slate-900">{enrollment.course.title}</h3><p className="mt-1 text-xs text-slate-600">Trainer: {enrollment.course.instructor.name}</p></div><Link href={`/courses/${enrollment.course.id}`} className="button-secondary shrink-0 text-xs">Continue learning <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded bg-slate-100" role="progressbar" aria-label={`${enrollment.course.title} progress`} aria-valuenow={Math.round(enrollment.progress)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-gov-blue" style={{ width: `${Math.min(100, enrollment.progress)}%` }} /></div><span className="text-[11px] font-medium text-slate-700">{Math.round(enrollment.progress)}%</span></div>
          </article>)}</div> : <div className="mt-4 rounded border border-dashed border-slate-300 bg-slate-50 p-5 text-xs text-slate-600">You are not enrolled in a course yet. Follow a recommended path or browse the catalogue.</div>}
        </div>

        <div className="space-y-6">
          <section className="surface p-5">
            <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Assessments</h2></div>
            {relevantAssessments.length ? <ul className="mt-4 divide-y divide-slate-200">{relevantAssessments.map((assessment) => {
              const result = attempts.find((attempt) => attempt.questionnaire.id === assessment.id);
              return <li key={assessment.id} className="py-3 first:pt-0 last:pb-0"><p className="text-xs font-semibold text-slate-900">{assessment.title}</p><p className="mt-1 text-[11px] text-slate-500">{assessment.course?.title || assessment.subject.name}{assessment.deadline ? ` · Due ${new Date(assessment.deadline).toLocaleDateString()}` : ''}</p>{result ? <p className="mt-1 text-[11px] font-medium text-slate-700">{result.isPassed ? 'Passed' : 'Attempt recorded'} · {result.score ?? '—'}%</p> : <Link href={`/tests/${assessment.id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gov-accent hover:underline">Start assessment <ArrowRight className="h-3 w-3" /></Link>}</li>;
            })}</ul> : <p className="mt-4 text-xs text-slate-600">No assessments are attached to your enrolled courses.</p>}
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2"><Award className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Certificates</h2></div>
            {feedback && <p role="status" className="mt-3 rounded border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900">{feedback}</p>}
            {enrollments.length ? <ul className="mt-3 space-y-3">{enrollments.map((enrollment) => {
              const passedCourseAssessment = attempts.some((attempt) => attempt.questionnaire.courseId === enrollment.course.id && attempt.isPassed);
              const eligible = enrollment.progress >= 100 && passedCourseAssessment;
              return <li key={enrollment.id} className="border-t border-slate-200 pt-3 first:border-0 first:pt-0"><p className="text-xs font-semibold text-slate-900">{enrollment.course.title}</p>{enrollment.certificate ? <Link href={`/verify/${enrollment.certificate.serialNumber}`} className="mt-1 inline-flex text-[11px] font-semibold text-emerald-800 hover:underline">Issued · verify certificate</Link> : eligible ? <button type="button" disabled={busyCertificate === enrollment.id} onClick={() => issueCertificate(enrollment)} className="mt-2 button-secondary text-[11px]">{busyCertificate === enrollment.id ? 'Issuing…' : 'Issue eligible certificate'}</button> : <p className="mt-1 text-[11px] text-slate-500">{enrollment.progress < 100 ? `${Math.round(enrollment.progress)}% course completion` : 'Complete and pass the course assessment to become eligible.'}</p>}</li>;
            })}</ul> : <p className="mt-3 text-xs text-slate-600">No certificates yet. Complete a course and pass its assessment to become eligible.</p>}
            {issuedCertificates.length === 0 && enrollments.length > 0 && <p className="mt-3 border-t border-slate-200 pt-3 text-[10px] leading-4 text-slate-500">Certificates are generated only after course progress and a passing assessment are recorded.</p>}
          </section>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <div className="surface p-5"><div className="flex items-center gap-2"><CircleHelp className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Recent assessment results</h2></div>{recentAttempts.length ? <ul className="mt-3 space-y-2">{recentAttempts.map((attempt) => <li key={attempt.id} className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 first:border-0"><span className="text-xs text-slate-700">{attempt.questionnaire.title}</span><span className="text-xs font-semibold text-slate-800">{attempt.score ?? '—'}%</span></li>)}</ul> : <p className="mt-3 text-xs text-slate-600">No assessment attempts yet.</p>}</div>
        <div className="surface p-5"><div className="flex items-center gap-2"><FileTextIcon /><h2 className="section-heading">Announcements</h2></div>{notices.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{notices.slice(0, 4).map((notice) => <li key={notice.id} className="border-l-2 border-slate-300 pl-3"><p className="text-[10px] font-semibold uppercase text-slate-500">{notice.type.replace('_', ' ')} · {new Date(notice.publishAt).toLocaleDateString()}</p><h3 className="mt-1 text-xs font-semibold text-slate-900">{notice.title}</h3><p className="mt-1 text-[11px] leading-4 text-slate-600">{notice.content}</p></li>)}</ul> : <p className="mt-3 text-xs text-slate-600">No announcements have been published.</p>}</div>
      </section>
    </div>
  );
}

function FileTextIcon() {
  return <BookOpen className="h-4 w-4 text-gov-accent" />;
}
