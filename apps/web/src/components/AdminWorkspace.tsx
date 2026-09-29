'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';
import { Activity, Bell, CheckCircle2, ClipboardCheck, Users } from 'lucide-react';

type UserRecord = { id: string; name: string; email: string; role: string | null; requestedRole?: string | null; status: string; department?: string | null; designation?: string | null; employeeId?: string | null; createdAt: string };
type Stats = { totalUsers: number; activeTrainees: number; activeTrainers: number; pendingApprovals: number; totalCourses: number; totalEnrollments: number; completedEnrollments: number; totalCertificates: number; totalAssessments: number; assessmentAttempts: number; completionRate: number; enrollmentTrend: { month: string; count: number }[]; competencyDistribution: { id?: string; name: string; category: string; traineeCount: number; averageProficiency: number }[] };
type Subject = { name: string };
type SubmittedCourse = { id: string; title: string; description: string; level: string; subject: Subject; instructor: { name: string; email: string }; updatedAt: string; _count: { modules: number; enrollments: number } };
type Announcement = { id: string; title: string; content: string; type: string; publishAt: string; pinned: boolean };
type HeatRow = { department: string; skills: { skill: string; averageProficiency: number; sampleSize: number }[] };

type AdminTab = 'people' | 'courses' | 'announcements' | 'analytics';

export function AdminWorkspace() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('people');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [submittedCourses, setSubmittedCourses] = useState<SubmittedCourse[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [heatmap, setHeatmap] = useState<HeatRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'NOTICE' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const [session, report, userPage, courseQueue, noticeList, skillData] = await Promise.all([
          apiRequest<{ user: { role: string } }>('me'),
          apiRequest<Stats>('admin/stats'),
          apiRequest<{ data: UserRecord[] }>('admin/users?limit=100'),
          apiRequest<SubmittedCourse[]>('courses/admin/submissions'),
          apiRequest<Announcement[]>('public/announcements'),
          apiRequest<HeatRow[]>('admin/skill-heatmap'),
        ]);
        if (!active) return;
        if (session.user.role !== 'ADMIN') { router.replace('/portal'); return; }
        setStats(report);
        setUsers(userPage.data || []);
        setSubmittedCourses(courseQueue);
        setAnnouncements(noticeList);
        setHeatmap(skillData);
      } catch (loadError) {
        if (!active) return;
        if (typeof loadError === 'object' && loadError && 'status' in loadError && (loadError as {status:number}).status === 401) { router.replace('/auth/login'); return; }
        setError(loadError instanceof Error ? loadError.message : 'The administration workspace could not be loaded.');
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [reload, router]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.name} ${user.email} ${user.department || ''} ${user.employeeId || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'ALL' || user.status === statusFilter);
  }), [users, search, statusFilter]);

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 5000); }

  async function changeUser(user: UserRecord, action: 'approve' | 'reject' | 'role', role?: string) {
    setSavingId(user.id); setError(''); setNotice('');
    try {
      if (action === 'approve') await apiRequest(`admin/users/${user.id}/approve`, { method: 'PATCH', body: JSON.stringify({ role: role || user.requestedRole || 'TRAINEE' }) });
      else if (action === 'reject') await apiRequest(`admin/users/${user.id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason: 'Declined by the administrator.' }) });
      else await apiRequest(`admin/users/${user.id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      flash(action === 'approve' ? `${user.name} approved.` : action === 'reject' ? `${user.name} declined.` : `Role updated for ${user.name}.`);
      setReload((value) => value + 1);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The user record could not be updated.'); }
    finally { setSavingId(null); }
  }

  async function approveCourse(course: SubmittedCourse) {
    setSavingId(course.id); setError(''); setNotice('');
    try { await apiRequest(`courses/${course.id}/approve`, { method: 'PATCH' }); flash(`${course.title} published.`); setReload((value) => value + 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Course publication failed.'); }
    finally { setSavingId(null); }
  }

  async function createAnnouncement(event: FormEvent) {
    event.preventDefault(); setSavingId('announcement'); setError(''); setNotice('');
    try { await apiRequest('cms/announcements', { method: 'POST', body: JSON.stringify(announcementForm) }); setAnnouncementForm({ title: '', content: '', type: 'NOTICE' }); flash('Announcement published.'); setReload((value) => value + 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Announcement could not be published.'); }
    finally { setSavingId(null); }
  }

  async function deleteAnnouncement(item: Announcement) {
    setSavingId(item.id); setError(''); setNotice('');
    try { await apiRequest(`cms/announcements/${item.id}`, { method: 'DELETE' }); flash('Announcement removed.'); setReload((value) => value + 1); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Announcement could not be removed.'); }
    finally { setSavingId(null); }
  }

  if (loading) return <div className="page-container py-16 text-center text-sm text-slate-600">Loading organization records…</div>;
  if (error && !stats) return <div className="page-container py-12"><div role="alert" className="max-w-2xl border border-rose-200 bg-white p-5"><h1 className="font-semibold">Administration workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><button onClick={() => setReload((value) => value + 1)} className="button-secondary mt-4 text-xs">Try again</button></div></div>;

  const maxTrend = Math.max(1, ...(stats?.enrollmentTrend || []).map((month) => month.count));

  return (
    <div className="page-container space-y-7 py-8 sm:py-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Administrator workspace · Sample records</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Organization learning oversight</h1><p className="mt-2 text-sm text-slate-600">Review access, programme publication, announcements, and participation using current platform records.</p></div><span className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Demo dataset</span></header>
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Organization summary">
        {[
          ['Active trainees', stats?.activeTrainees ?? 0], ['Active trainers', stats?.activeTrainers ?? 0],
          ['Published courses', stats?.totalCourses ?? 0], ['Pending approvals', stats?.pendingApprovals ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="surface p-4"><span className="eyebrow">{label}</span><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div>)}
      </section>
      <section className="grid gap-3 sm:grid-cols-3"><div className="surface p-4"><p className="text-[11px] text-slate-500">Enrolments</p><p className="mt-1 text-lg font-semibold text-slate-900">{stats?.totalEnrollments ?? 0}</p></div><div className="surface p-4"><p className="text-[11px] text-slate-500">Course completion</p><p className="mt-1 text-lg font-semibold text-slate-900">{stats?.completionRate ?? 0}%</p></div><div className="surface p-4"><p className="text-[11px] text-slate-500">Assessment attempts</p><p className="mt-1 text-lg font-semibold text-slate-900">{stats?.assessmentAttempts ?? 0}</p></div></section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Administration sections">
        {([['people','Users & approvals'],['courses','Course review'],['announcements','Announcements'],['analytics','Analytics']] as [AdminTab,string][]).map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`rounded px-3 py-2 text-xs font-semibold ${tab === value ? 'bg-gov-navy text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{label}</button>)}
      </div>

      {tab === 'people' && <section className="surface p-5"><div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="section-heading">User approvals and role management</h2><p className="mt-1 text-xs text-slate-600">Only active users receive protected workspace access.</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="sr-only" htmlFor="user-search">Search users</label><input id="user-search" className="field min-w-48" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, department" /><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{['PENDING','ACTIVE','REJECTED','DEACTIVATED'].map((status) => <option key={status}>{status}</option>)}</select></div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Person</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredUsers.map((person) => <tr key={person.id}><td className="px-3 py-3"><p className="font-semibold text-slate-900">{person.name}</p><p className="mt-1 text-[10px] text-slate-500">{person.email} · {person.employeeId || 'ID not recorded'}</p></td><td className="px-3 py-3 text-slate-700">{person.department || '—'}<span className="block text-[10px] text-slate-500">{person.designation || ''}</span></td><td className="px-3 py-3 text-slate-700">{person.role || person.requestedRole || 'Unassigned'}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[10px] font-semibold ${person.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : person.status === 'PENDING' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{person.status}</span></td><td className="px-3 py-3"><div className="flex flex-wrap items-center gap-2">{person.status === 'PENDING' ? <><label className="sr-only" htmlFor={`approve-role-${person.id}`}>Role to assign</label><select id={`approve-role-${person.id}`} className="rounded border border-slate-300 px-2 py-1.5 text-[11px]" defaultValue={person.requestedRole || 'TRAINEE'} onChange={(event) => setUsers((current) => current.map((item) => item.id === person.id ? { ...item, requestedRole: event.target.value } : item))}><option value="TRAINEE">Trainee</option><option value="TRAINER">Trainer</option><option value="ADMIN">Admin</option></select><button type="button" disabled={savingId === person.id} onClick={() => changeUser(person, 'approve', person.requestedRole || 'TRAINEE')} className="text-[11px] font-semibold text-emerald-800 hover:underline">Approve</button><button type="button" disabled={savingId === person.id} onClick={() => changeUser(person, 'reject')} className="text-[11px] font-semibold text-rose-700 hover:underline">Reject</button></> : person.status === 'ACTIVE' ? <><label className="sr-only" htmlFor={`role-${person.id}`}>Assign role</label><select id={`role-${person.id}`} className="rounded border border-slate-300 px-2 py-1.5 text-[11px]" value={person.role || 'TRAINEE'} onChange={(event) => changeUser(person, 'role', event.target.value)}><option value="TRAINEE">Trainee</option><option value="TRAINER">Trainer</option><option value="ADMIN">Admin</option></select></> : <span className="text-[11px] text-slate-500">No action available</span>}</div></td></tr>)}</tbody></table>
          {!filteredUsers.length && <p className="border-t border-slate-100 py-8 text-center text-xs text-slate-600">No users match these filters.</p>}</div>
      </section>}

      {tab === 'courses' && <section className="surface p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-gov-accent" /><div><h2 className="section-heading">Courses awaiting review</h2><p className="mt-1 text-xs text-slate-600">Review the submitted course outline and trainer before publishing it in the catalogue.</p></div></div>
        {submittedCourses.length ? <ul className="mt-4 divide-y divide-slate-200">{submittedCourses.map((course) => <li key={course.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{course.subject.name} · {course.level}</p><h3 className="mt-1 text-sm font-semibold text-slate-900">{course.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{course.description}</p><p className="mt-2 text-[11px] text-slate-500">Submitted by {course.instructor.name} · {course.instructor.email} · {course._count.modules} modules · {course._count.enrollments} enrolments</p></div><button type="button" disabled={savingId === course.id} onClick={() => approveCourse(course)} className="button-primary shrink-0 text-xs">{savingId === course.id ? 'Publishing…' : 'Approve and publish'}</button></li>)}</ul> : <div className="mt-4 rounded border border-dashed border-slate-300 p-6 text-center text-xs text-slate-600">No submitted courses are awaiting review.</div>}
      </section>}

      {tab === 'announcements' && <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><section className="surface p-5"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Publish an announcement</h2></div><form onSubmit={createAnnouncement} className="mt-4 space-y-3"><div><label htmlFor="announcement-title" className="field-label">Title</label><input id="announcement-title" required maxLength={160} className="field" value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} /></div><div><label htmlFor="announcement-type" className="field-label">Category</label><select id="announcement-type" className="field" value={announcementForm.type} onChange={(event) => setAnnouncementForm({ ...announcementForm, type: event.target.value })}><option value="NOTICE">Notice</option><option value="ACHIEVEMENT">Achievement</option><option value="NEW_CONTENT">New learning content</option></select></div><div><label htmlFor="announcement-content" className="field-label">Content</label><textarea id="announcement-content" required rows={5} className="field" value={announcementForm.content} onChange={(event) => setAnnouncementForm({ ...announcementForm, content: event.target.value })} /></div><button disabled={savingId === 'announcement'} className="button-primary w-full text-xs">{savingId === 'announcement' ? 'Publishing…' : 'Publish announcement'}</button></form></section>
        <section className="surface p-5"><h2 className="section-heading">Published announcements</h2>{announcements.length ? <ul className="mt-3 divide-y divide-slate-200">{announcements.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.type.replaceAll('_',' ')} · {new Date(item.publishAt).toLocaleDateString()}</p><h3 className="mt-1 text-xs font-semibold text-slate-900">{item.title}</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{item.content}</p></div><button type="button" disabled={savingId === item.id} onClick={() => deleteAnnouncement(item)} className="shrink-0 text-[11px] font-semibold text-rose-700 hover:underline">Remove</button></li>)}</ul> : <p className="mt-4 text-xs text-slate-600">No announcements have been published.</p>}</section></div>}

      {tab === 'analytics' && <div className="grid gap-6 lg:grid-cols-2"><section className="surface p-5"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Enrolment trend</h2></div><p className="mt-1 text-[11px] text-slate-500">Counts grouped from recorded course enrolment dates.</p>{stats?.enrollmentTrend.length ? <div className="mt-5 space-y-3">{stats.enrollmentTrend.map((month) => <div key={`${month.month}-${month.count}`} className="grid grid-cols-[36px_1fr_30px] items-center gap-3"><span className="text-[11px] text-slate-600">{month.month}</span><div className="h-3 overflow-hidden rounded-sm bg-slate-100"><div className="h-full bg-gov-blue" style={{ width: `${(month.count / maxTrend) * 100}%` }} /></div><span className="text-right text-[11px] font-semibold text-slate-700">{month.count}</span></div>)}</div> : <p className="mt-4 text-xs text-slate-600">No enrolment trend data is available.</p>}</section>
        <section className="surface p-5"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-gov-accent" /><h2 className="section-heading">Competency distribution</h2></div><p className="mt-1 text-[11px] text-slate-500">Saved profile skill levels, grouped by competency.</p>{stats?.competencyDistribution.length ? <div className="mt-4 divide-y divide-slate-200">{stats.competencyDistribution.map((item) => <div key={item.name} className="flex items-center justify-between gap-4 py-3"><div><p className="text-xs font-semibold text-slate-900">{item.name}</p><p className="mt-1 text-[10px] text-slate-500">{item.category} · {item.traineeCount} profiles</p></div><span className="text-xs font-medium text-slate-700">Mean level {item.averageProficiency}/5</span></div>)}</div> : <p className="mt-4 text-xs text-slate-600">No competency profile data has been recorded.</p>}</section>
        <section className="surface p-5 lg:col-span-2"><h2 className="section-heading">Department skill map</h2><p className="mt-1 text-[11px] text-slate-500">Average of declared profile levels by department; this is not a verified competency assessment.</p>{heatmap.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{heatmap.map((row) => <article key={row.department} className="border-t border-slate-200 pt-3"><h3 className="text-xs font-semibold text-slate-900">{row.department}</h3>{row.skills.map((skill) => <div key={skill.skill} className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-600">{skill.skill}</span><span className="font-medium text-slate-800">{skill.averageProficiency}/5 · n={skill.sampleSize}</span></div>)}</article>)}</div> : <p className="mt-4 text-xs text-slate-600">No departmental skill data is available.</p>}</section>
      </div>}
    </div>
  );
}
