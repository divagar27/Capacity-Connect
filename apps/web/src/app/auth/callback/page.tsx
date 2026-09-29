'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';

function CallbackContent() {
  const searchParams = useSearchParams(); const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    const code = searchParams.get('code'); const state = searchParams.get('state'); const oauthError = searchParams.get('error');
    if (oauthError) { setError(`Google sign-in was cancelled or rejected (${oauthError}).`); return; }
    const expectedState = sessionStorage.getItem('oauth_state'); const verifier = sessionStorage.getItem('oauth_code_verifier');
    if (!code || !state || !expectedState || !verifier || state !== expectedState) { setError('The sign-in session could not be verified. Please start again.'); return; }
    sessionStorage.removeItem('oauth_state'); sessionStorage.removeItem('oauth_code_verifier');
    let active = true;
    fetch(`/api/v1/auth/google/callback?code=${encodeURIComponent(code)}&code_verifier=${encodeURIComponent(verifier)}`, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then((response) => {
        if (!active) return;
        if (response.redirected) { window.location.assign(response.url); return; }
        if (response.ok) { router.replace('/portal'); return; }
        return response.json().catch(() => ({})).then((payload) => { if (active) setError(payload.message || 'Google sign-in could not be completed.'); });
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Network error during sign-in.'); });
    return () => { active = false; };
  }, [router, searchParams]);

  return <div className="page-container flex min-h-[65vh] items-center justify-center py-10"><section className="surface w-full max-w-md p-7 text-center">
    {error ? <><XCircle className="mx-auto h-9 w-9 text-rose-700" /><h1 className="mt-3 text-lg font-semibold">Sign-in could not be completed</h1><p role="alert" className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p><button className="button-primary mt-4 text-xs" onClick={() => router.replace('/auth/login')}>Return to sign in</button></> : <><Loader2 className="mx-auto h-8 w-8 animate-spin text-gov-blue" /><h1 className="mt-3 text-lg font-semibold">Completing sign-in…</h1><p className="mt-2 text-sm text-slate-600">Verifying the sign-in response and opening your workspace.</p></>}
  </section></div>;
}

export default function AuthCallbackPage() { return <Suspense fallback={<div className="page-container py-16 text-center text-sm text-slate-600">Loading sign-in…</div>}><CallbackContent /></Suspense>; }
