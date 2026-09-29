'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, Network, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

type SessionUser = {
  id: string;
  name: string;
  role: 'TRAINEE' | 'TRAINER' | 'ADMIN' | null;
  status: string;
};

const roleLinks: Record<string, { label: string; href: string }[]> = {
  TRAINEE: [
    { label: 'My Learning', href: '/portal/trainee' },
    { label: 'Competency Map', href: '/portal/trainee#competency-map' },
    { label: 'Find Trainers', href: '/competency' },
  ],
  TRAINER: [
    { label: 'Trainer Workspace', href: '/portal/trainer' },
    { label: 'Course Catalogue', href: '/courses' },
  ],
  ADMIN: [
    { label: 'Administration', href: '/portal/admin' },
    { label: 'Course Catalogue', href: '/courses' },
  ],
};

export function NavigationHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: SessionUser }>('me')
      .then((result) => { if (active) setCurrentUser(result.user); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const links = currentUser?.role ? roleLinks[currentUser.role] || [] : [];
  const workspace = currentUser?.role ? `/portal/${currentUser.role.toLowerCase()}` : '/portal';

  async function handleLogout() {
    setSigningOut(true);
    try { await apiRequest('auth/logout', { method: 'POST' }); } catch { /* Clear the local view even if the session has expired. */ }
    setCurrentUser(null);
    setSigningOut(false);
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-sm" aria-label="Capacity Connect home">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gov-navy text-white">
            <Network aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-[0.08em] text-slate-900">CAPACITY CONNECT</span>
            <span className="hidden text-[11px] text-slate-500 sm:block">Digital capacity building · MoES / IMD</span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          <Link href="/courses" className="nav-link">Learning catalogue</Link>
          {currentUser && links.map((item) => <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>)}
          <Link href="/verify" className="nav-link">Verify certificate</Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {currentUser ? (
            <>
              <Link href={workspace} className="text-right leading-tight">
                <span className="block max-w-40 truncate text-xs font-semibold text-slate-800">{currentUser.name}</span>
                <span className="mt-1 block text-[10px] uppercase tracking-wide text-slate-500">{currentUser.role || currentUser.status}</span>
              </Link>
              <button type="button" onClick={handleLogout} disabled={signingOut} className="button-secondary px-3 py-2 text-xs">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <Link href="/auth/login" className="button-primary px-4 py-2 text-xs">{authChecked ? 'Sign in' : 'Open portal'}</Link>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-offset-2 lg:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <Link href="/courses" className="nav-link">Learning catalogue</Link>
            {currentUser && links.map((item) => <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>)}
            <Link href="/verify" className="nav-link">Verify certificate</Link>
            {currentUser ? (
              <button type="button" onClick={handleLogout} disabled={signingOut} className="mt-2 w-full button-secondary text-xs">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            ) : <Link href="/auth/login" className="mt-2 w-full button-primary text-center text-xs">Sign in</Link>}
          </div>
        </nav>
      )}
    </header>
  );
}
