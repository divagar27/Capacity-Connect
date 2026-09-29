'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, ApiError } from '../../lib/api';
import { RefreshCw, UserRound } from 'lucide-react';

type SessionUser = { email: string; name: string; status: string; requestedRole?: string | null };

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [requestedRole, setRequestedRole] = useState<'TRAINEE' | 'TRAINER'>('TRAINEE');
  const [department, setDepartment] = useState(''); const [designation, setDesignation] = useState(''); const [employeeId, setEmployeeId] = useState(''); const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    apiRequest<{ user: SessionUser }>('me').then(({ user: current }) => { setUser(current); if (current.requestedRole === 'TRAINER') setRequestedRole('TRAINER'); })
      .catch((reason: unknown) => { if (reason instanceof ApiError && reason.status === 401) router.replace('/auth/login'); else setError(reason instanceof Error ? reason.message : 'Account details could not be loaded.'); })
      .finally(() => setLoading(false));
  }, [router]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { await apiRequest('auth/onboarding', { method: 'POST', body: JSON.stringify({ requestedRole, department, designation, employeeId, phone }) }); router.replace('/pending-approval'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your request could not be submitted.'); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="page-container py-16 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading account…</main>;
  return <main className="page-container py-10"><section className="surface mx-auto max-w-2xl p-6 sm:p-8"><div className="flex items-start gap-3 border-b border-slate-200 pb-5"><span className="rounded bg-slate-100 p-2"><UserRound className="h-5 w-5" /></span><div><p className="eyebrow">Account setup</p><h1 className="mt-1 text-xl font-semibold">Request workspace access</h1><p className="mt-2 text-sm text-slate-600">Provide the profile details your organization uses to review access. Your account remains pending until an administrator approves it.</p></div></div>
    {error ? <p role="alert" className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {user?.status === 'ACTIVE' ? <div className="mt-5"><p className="text-sm text-slate-700">This account is already active.</p><button className="button-primary mt-4 text-xs" onClick={() => router.replace('/portal')}>Open workspace</button></div> : <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-slate-700 sm:col-span-2">Signed-in account<input readOnly className="field mt-1 w-full bg-slate-50" value={user?.email || ''} /></label><label className="text-xs font-medium text-slate-700">Requested role<select className="field mt-1 w-full" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as 'TRAINEE' | 'TRAINER')}><option value="TRAINEE">Trainee</option><option value="TRAINER">Trainer</option></select></label><label className="text-xs font-medium text-slate-700">Phone<input required className="field mt-1 w-full" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="text-xs font-medium text-slate-700">Department<input required className="field mt-1 w-full" value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label className="text-xs font-medium text-slate-700">Designation<input required className="field mt-1 w-full" value={designation} onChange={(event) => setDesignation(event.target.value)} /></label><label className="text-xs font-medium text-slate-700 sm:col-span-2">Employee ID as assigned by your organization<input required className="field mt-1 w-full" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} /></label><p className="text-xs leading-5 text-slate-500 sm:col-span-2">Only enter an organization-issued employee ID. Capacity Connect does not issue or validate identity documents through this form.</p><button disabled={saving} className="button-primary justify-center text-xs sm:col-span-2">{saving ? 'Submitting request…' : 'Submit for review'}</button></form>}
  </section></main>;
}
