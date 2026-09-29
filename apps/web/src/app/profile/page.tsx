'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiRequest } from '../../lib/api';
import { ArrowLeft, RefreshCw, Save, UserRound } from 'lucide-react';

type SkillTaxonomy = { id: string; name: string; category: string; children?: SkillTaxonomy[] };
type Profile = { id: string; name: string; email: string; role: string | null; status: string; requestedRole?: string | null; employeeId?: string | null; department?: string | null; designation?: string | null; phone?: string | null; qualifications: { id: string; degree: string; field: string; institution: string; year: number }[]; workExperiences: { id: string; title: string; organization?: string; startYear: number; endYear?: number | null }[]; userSkills: { skillId: string; proficiency: number; targetProficiency?: number | null; skill: { id: string; name: string; category: string } }[]; certificates: { id: string; title: string; issuingBody: string; issueYear: number }[] };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taxonomy, setTaxonomy] = useState<SkillTaxonomy[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState({ degree: '', field: '', institution: '', year: new Date().getFullYear() });
  const [experience, setExperience] = useState({ title: '', organization: '', startYear: new Date().getFullYear(), endYear: '' });
  const [skillId, setSkillId] = useState(''); const [proficiency, setProficiency] = useState(3); const [targetProficiency, setTargetProficiency] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [me, skills] = await Promise.all([apiRequest<Profile>('profiles/me'), apiRequest<SkillTaxonomy[]>('profiles/skills/taxonomy')]);
      setProfile(me); setName(me.name || ''); setPhone(me.phone || ''); setTaxonomy(skills || []);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) router.replace('/auth/login?redirect=/profile');
      else setError(reason instanceof Error ? reason.message : 'Your profile could not be loaded.');
    } finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  async function savePersonal(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const result = await apiRequest<{ user: Profile }>('me/profile', { method: 'PATCH', body: JSON.stringify({ name, phone }) }); setProfile((current) => current ? { ...current, ...result.user } : current); setMessage('Personal details saved.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  }
  async function submitRecord(event: FormEvent, path: string, data: unknown) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await apiRequest(path, { method: 'POST', body: JSON.stringify(data) }); await load(); setMessage('Profile record added.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Profile record could not be saved.'); }
    finally { setBusy(false); }
  }
  async function saveSkill(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await apiRequest('profiles/skills', { method: 'POST', body: JSON.stringify({ skillId, proficiency, ...(targetProficiency ? { targetProficiency } : {}) }) }); await load(); setMessage('Proficiency saved.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Proficiency could not be saved.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="page-container py-16 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading profile…</main>;
  if (!profile) return <main className="page-container py-10"><section role="alert" className="surface mx-auto max-w-xl p-5"><h1 className="font-semibold">Profile unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><Link className="button-secondary mt-4 text-xs" href="/auth/login">Sign in</Link></section></main>;

  const skillOptions = taxonomy.flatMap((group) => [group, ...(group.children || [])]);
  return <main className="page-container space-y-6 py-8">
    <header className="flex items-end justify-between gap-3 border-b border-slate-200 pb-5"><div><Link href="/portal" className="inline-flex items-center gap-1 text-xs text-gov-blue hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Workspace</Link><p className="eyebrow mt-3">Professional profile</p><h1 className="mt-1 text-2xl font-semibold">{profile.name}</h1><p className="mt-1 text-sm text-slate-600">Profile records and declared skill levels. They are not independently verified by this application.</p></div><span className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">{profile.status}{profile.requestedRole ? ` · requested ${profile.requestedRole}` : ''}</span></header>
    {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}{message ? <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    <section className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={savePersonal} className="surface space-y-4 p-5"><h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4" />Account details</h2><label className="block text-xs font-medium text-slate-700">Name<input required className="field mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-xs font-medium text-slate-700">Email<input className="field mt-1 w-full bg-slate-50" value={profile.email} readOnly /></label><label className="block text-xs font-medium text-slate-700">Phone<input className="field mt-1 w-full" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Role</dt><dd className="mt-1">{profile.role || profile.requestedRole || 'Not assigned'}</dd></div><div><dt className="text-slate-500">Employee ID</dt><dd className="mt-1">{profile.employeeId || 'Not provided'}</dd></div><div><dt className="text-slate-500">Department</dt><dd className="mt-1">{profile.department || 'Not provided'}</dd></div><div><dt className="text-slate-500">Designation</dt><dd className="mt-1">{profile.designation || 'Not provided'}</dd></div></dl><button disabled={busy} className="button-primary text-xs"><Save className="h-4 w-4" />Save details</button></form>
      <div className="surface p-5"><h2 className="font-semibold">Declared skills</h2>{profile.userSkills.length ? <ul className="mt-3 space-y-2">{profile.userSkills.map((item) => <li key={item.skillId} className="flex justify-between gap-3 rounded bg-slate-50 px-3 py-2 text-sm"><span>{item.skill.name}<small className="ml-2 text-xs text-slate-500">{item.skill.category}</small></span><span className="font-medium">{item.proficiency}/5{item.targetProficiency ? ` · target ${item.targetProficiency}` : ''}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No skill levels have been declared.</p>}
        <form onSubmit={saveSkill} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"><label className="min-w-48 flex-1 text-xs font-medium">Skill<select className="field mt-1 w-full" value={skillId} required onChange={(event) => setSkillId(event.target.value)}><option value="">Choose a skill</option>{skillOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label><label className="text-xs font-medium">Current level<select className="field mt-1" value={proficiency} onChange={(event) => setProficiency(Number(event.target.value))}>{[1,2,3,4,5].map((level) => <option key={level} value={level}>{level}/5</option>)}</select></label><label className="text-xs font-medium">Target level<select className="field mt-1" value={targetProficiency} onChange={(event) => setTargetProficiency(Number(event.target.value))}><option value={0}>No target</option>{[1,2,3,4,5].map((level) => <option key={level} value={level}>{level}/5</option>)}</select></label><button disabled={busy} className="button-secondary text-xs">Save skill</button></form></div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="surface p-5"><h2 className="font-semibold">Education</h2><ul className="mt-3 space-y-2">{profile.qualifications.map((item) => <li key={item.id} className="border-b border-slate-100 pb-2 text-sm"><strong>{item.degree} · {item.field}</strong><span className="block text-xs text-slate-500">{item.institution} · {item.year}</span></li>)}</ul><form onSubmit={(event) => void submitRecord(event, 'profiles/qualifications', qualification)} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2"><input required className="field" placeholder="Degree" value={qualification.degree} onChange={(event) => setQualification({ ...qualification, degree: event.target.value })} /><input required className="field" placeholder="Field" value={qualification.field} onChange={(event) => setQualification({ ...qualification, field: event.target.value })} /><input required className="field" placeholder="Institution" value={qualification.institution} onChange={(event) => setQualification({ ...qualification, institution: event.target.value })} /><input required className="field" type="number" aria-label="Year" value={qualification.year} onChange={(event) => setQualification({ ...qualification, year: Number(event.target.value) })} /><button disabled={busy} className="button-secondary justify-center text-xs sm:col-span-2">Add education</button></form></div>
      <div className="surface p-5"><h2 className="font-semibold">Work experience</h2><ul className="mt-3 space-y-2">{profile.workExperiences.map((item) => <li key={item.id} className="border-b border-slate-100 pb-2 text-sm"><strong>{item.title}</strong><span className="block text-xs text-slate-500">{item.organization || 'Organization not recorded'} · {item.startYear}{item.endYear ? `–${item.endYear}` : '–present'}</span></li>)}</ul><form onSubmit={(event) => void submitRecord(event, 'profiles/experiences', { ...experience, endYear: experience.endYear ? Number(experience.endYear) : undefined })} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2"><input required className="field" placeholder="Role / title" value={experience.title} onChange={(event) => setExperience({ ...experience, title: event.target.value })} /><input className="field" placeholder="Organization" value={experience.organization} onChange={(event) => setExperience({ ...experience, organization: event.target.value })} /><input required className="field" type="number" aria-label="Start year" value={experience.startYear} onChange={(event) => setExperience({ ...experience, startYear: Number(event.target.value) })} /><input className="field" type="number" placeholder="End year (optional)" value={experience.endYear} onChange={(event) => setExperience({ ...experience, endYear: event.target.value })} /><button disabled={busy} className="button-secondary justify-center text-xs sm:col-span-2">Add experience</button></form></div></section>
    <section className="surface p-5"><h2 className="font-semibold">Certificate records</h2>{profile.certificates.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{profile.certificates.map((item) => <li key={item.id} className="rounded border border-slate-200 p-3 text-sm"><strong>{item.title}</strong><span className="block text-xs text-slate-500">{item.issuingBody} · {item.issueYear}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No certificate records.</p>}</section>
  </main>;
}
