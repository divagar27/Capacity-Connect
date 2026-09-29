'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';
import { ArrowLeft, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

type Verification = { serialNumber: string; recipientName: string; courseTitle: string; issueDate: string; department?: string | null; organization: string; verifyHash: string };

export default function DirectVerifyPage() {
  const { serial } = useParams<{ serial: string }>();
  const [result, setResult] = useState<Verification | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiRequest<Verification>(`verify/${encodeURIComponent(serial)}`).then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No matching training record was found.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [serial]);
  return <main className="page-container py-9"><Link href="/verify" className="inline-flex items-center gap-2 text-sm text-gov-blue hover:underline"><ArrowLeft className="h-4 w-4" />Record lookup</Link><section className="surface mx-auto mt-5 max-w-3xl p-6 sm:p-8">
    {loading ? <div className="py-8 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Checking saved record…</div> : result ? <><div className="flex items-start gap-3 border-b border-slate-200 pb-4"><CheckCircle2 className="h-7 w-7 text-emerald-700" /><div><p className="eyebrow">Record found</p><h1 className="mt-1 text-lg font-semibold">Training record located</h1><p className="mt-1 font-mono text-xs text-slate-600">{result.serialNumber}</p></div></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="eyebrow">Recipient</dt><dd className="mt-1 text-sm font-medium">{result.recipientName}</dd></div><div><dt className="eyebrow">Course</dt><dd className="mt-1 text-sm font-medium">{result.courseTitle}</dd></div><div><dt className="eyebrow">Configured issuer</dt><dd className="mt-1 text-sm">{result.organization}</dd></div><div><dt className="eyebrow">Issue date</dt><dd className="mt-1 text-sm">{new Date(result.issueDate).toLocaleDateString()}</dd></div></dl><div className="mt-5 rounded border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold">Record reference hash</p><code className="mt-1 block break-all text-[11px] text-slate-600">{result.verifyHash}</code></div><p className="mt-4 text-xs leading-5 text-slate-500">This lookup confirms that the record is present in this application’s database. It is not a check against an external government registry.</p></> : <div role="alert" className="py-8 text-center"><XCircle className="mx-auto h-8 w-8 text-rose-700" /><h1 className="mt-3 font-semibold">No matching record</h1><p className="mt-2 text-sm text-slate-600">{error}</p><p className="mt-1 font-mono text-xs text-slate-500">Serial checked: {serial}</p></div>}
  </section></main>;
}
