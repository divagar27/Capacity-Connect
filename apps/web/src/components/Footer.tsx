import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-semibold tracking-wide text-slate-800">CAPACITY CONNECT</p>
          <p className="mt-1">Capacity building and learning management prototype for MoES / IMD.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/courses" className="hover:text-gov-accent">Learning catalogue</Link>
          <Link href="/competency" className="hover:text-gov-accent">Find trainers</Link>
          <Link href="/verify" className="hover:text-gov-accent">Certificate verification</Link>
        </nav>
        <p className="text-[11px] text-slate-500">Seeded demonstration accounts and records are labelled as samples.</p>
      </div>
    </footer>
  );
}
