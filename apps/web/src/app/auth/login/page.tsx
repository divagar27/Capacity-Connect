'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { apiRequest } from '../../../lib/api';

const demoRoles = [
  { role: 'TRAINEE', label: 'Trainee', href: '/portal/trainee' },
  { role: 'TRAINER', label: 'Trainer', href: '/portal/trainer' },
  { role: 'ADMIN', label: 'Admin', href: '/portal/admin' },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function signInWithGoogle() {
    setLoading(true);
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('oauth_code_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then((digest) => {
      const digestBytes = new Uint8Array(digest);
      const codeChallenge = btoa(Array.from(digestBytes, (byte) => String.fromCharCode(byte)).join(''))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      window.location.assign(`/api/v1/auth/google?state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}`);
    }).catch(() => {
      setLoading(false);
      setError('This browser could not prepare a secure Google sign-in session.');
    });
  }

  async function useDemoAccount(role: typeof demoRoles[number]['role'], href: string) {
    setLoading(true);
    setError('');
    try {
      await apiRequest('auth/demo-switch', { method: 'POST', body: JSON.stringify({ role }) });
      router.push(href);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to open the demo account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container flex min-h-[65vh] items-center justify-center py-10">
      <div className="surface w-full max-w-lg p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gov-navy text-white"><LockKeyhole className="h-5 w-5" /></span>
          <div><p className="eyebrow">Secure access</p><h1 className="mt-1 text-xl font-semibold text-slate-900">Sign in to Capacity Connect</h1><p className="mt-1 text-xs leading-5 text-slate-600">Use your configured organizational identity provider. New accounts complete a profile and wait for administrator approval.</p></div>
        </div>

        <button type="button" onClick={signInWithGoogle} disabled={loading} className="button-primary mt-6 w-full py-3 text-sm">
          Continue with Google
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">Google sign-in requires OAuth credentials in the API environment.</p>

        {error && <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}

        <section className="mt-7 border-t border-slate-200 pt-5" aria-labelledby="demo-heading">
          <div className="flex items-center justify-between gap-3"><h2 id="demo-heading" className="text-sm font-semibold text-slate-900">Prototype demo accounts</h2><span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Sample data</span></div>
          <p className="mt-2 text-xs leading-5 text-slate-600">Open a role workspace for the seeded demonstration flow. Demo accounts are available only when the API is not running in production.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {demoRoles.map(({ role, label, href }) => (
              <button key={role} type="button" disabled={loading} onClick={() => useDemoAccount(role, href)} className="button-secondary w-full py-2.5 text-xs">
                {loading ? 'Opening…' : `Continue as ${label}`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">No password is used for these non-production sample identities.</p>
        </section>
      </div>
    </div>
  );
}
