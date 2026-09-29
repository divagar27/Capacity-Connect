'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest, ApiError } from '../../lib/api';
import { Clock3, RefreshCw } from 'lucide-react';

type Session = { user: { status: string; requestedRole?: string | null; email: string } };

export default function PendingApprovalPage() {
  const router = useRouter(); const [session, setSession] = useState<Session['user'] | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { apiRequest<Session>('me').then(({ user }) => { if (user.status === 'ACTIVE') router.replace('/portal'); else setSession(user); }).catch((reason: unknown) => { if (reason instanceof ApiError && reason.status === 401) router.replace('/auth/login'); else setError(reason instanceof Error ? reason.message : 'Account status could not be checked.'); }).finally(() => setLoading(false)); }, [router]);
  if (loading) return <main className="page-container py-16 text-center"><RefreshCw className="mx-auto h-5 w-5 animate-spin" /></main>;
  return <main className="page-container py-12"><section className="surface mx-auto max-w-xl p-7 text-center"><Clock3 className="mx-auto h-9 w-9 text-amber-700" /><p className="eyebrow mt-4">Account access</p><h1 className="mt-1 text-xl font-semibold">{session?.status === 'REJECTED' ? 'Access request not approved' : session?.status === 'DEACTIVATED' ? 'Account deactivated' : 'Request awaiting review'}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{error || (session?.status === 'PENDING' ? `The request for ${session.requestedRole || 'a workspace'} access under ${session.email} is pending administrator review.` : 'Contact your organization administrator for information about this account.')}</p>{session?.status === 'PENDING' ? <Link href="/onboarding" className="button-secondary mt-5 text-xs">Review submitted details</Link> : null}</section></main>;
}
