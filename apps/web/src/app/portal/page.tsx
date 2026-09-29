'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest, ApiError } from '../../lib/api';
import { ArrowRight, RefreshCw } from 'lucide-react';

type Role = 'ADMIN' | 'TRAINER' | 'TRAINEE';
type Session = { user: { role: Role | null; status: string; requestedRole?: string | null } };

export default function PortalPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<Session>('me').then(({ user }) => {
      if (!active) return;
      if (user.status === 'PENDING') { router.replace(user.requestedRole ? '/pending-approval' : '/onboarding'); return; }
      if (user.status === 'REJECTED' || user.status === 'DEACTIVATED') { router.replace('/pending-approval'); return; }
      const destinations: Record<Role, string> = {
        ADMIN: '/portal/admin', TRAINER: '/portal/trainer', TRAINEE: '/portal/trainee',
      };
      router.replace(destinations[user.role] || '/auth/login');
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) router.replace('/auth/login?redirect=/portal');
      else setError(reason instanceof Error ? reason.message : 'Your workspace could not be opened.');
    });
    return () => { active = false; };
  }, [router]);

  return <main className="page-container py-16 text-center">
    {error ? <section role="alert" className="surface mx-auto max-w-lg p-6">
      <h1 className="text-lg font-semibold">Workspace unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p>
      <Link className="button-primary mt-4 text-xs" href="/auth/login">Sign in <ArrowRight className="h-4 w-4" /></Link>
    </section> : <><RefreshCw className="mx-auto h-6 w-6 animate-spin text-gov-blue" /><p className="mt-3 text-sm text-slate-600">Opening your workspace…</p></>}
  </main>;
}
