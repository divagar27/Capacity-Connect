'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { Search, Users } from 'lucide-react';

type Evidence = { weight: string; points: number; maxPoints: number; evidenceType: string; summary: string; details: string[] };
type Trainer = { trainerId: string; name: string; email: string; isSample: boolean; department?: string | null; designation?: string | null; matchScore: number; evidenceSummary: { platformRecordedCount: number; selfDeclaredCount: number; missingCount: number }; breakdown: { relevantSkills: Evidence; relevantQualifications: Evidence; relevantExperience: Evidence; publishedCourseHistory: Evidence; learnerFeedback: Evidence } };

export default function CompetencyDirectoryPage() {
  const [subject, setSubject] = useState('Meteorology');
  const [query, setQuery] = useState('Meteorology');
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Trainer | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiRequest<Trainer[]>(`competency/trainers?subject=${encodeURIComponent(query)}`)
      .then((items) => { if (active) setTrainers(items || []); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Trainer directory could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  function search(event: React.FormEvent) { event.preventDefault(); setQuery(subject.trim() || 'Meteorology'); }
  const evidenceLabels: [keyof Trainer['breakdown'], string][] = [
    ['relevantSkills', 'Declared skills'], ['relevantQualifications', 'Declared qualifications'], ['relevantExperience', 'Declared experience'], ['publishedCourseHistory', 'Published courses'], ['learnerFeedback', 'Recorded feedback'],
  ];

  return <main className="page-container space-y-6 py-8">
    <header className="border-b border-slate-200 pb-5"><p className="eyebrow">Trainer directory</p><h1 className="mt-1 text-2xl font-semibold">Find subject trainers</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Trainer suggestions are ranked from saved profile skills, qualifications, experience, published courses, and platform-recorded feedback. Match scores summarize available records; profile credentials and skill levels are not independently verified, and the score is not an accreditation or quality certification.</p>
      <form onSubmit={search} className="mt-4 flex max-w-xl gap-2"><label className="relative flex-1"><span className="sr-only">Subject area</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="field w-full pl-9" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject or competency" /></label><button className="button-primary text-xs">Search</button></form>
    </header>
    {loading ? <p className="py-12 text-center text-sm text-slate-600">Finding trainers…</p> : error ? <p role="alert" className="surface p-4 text-sm text-rose-800">{error}</p> : trainers.length === 0 ? <section className="surface p-8 text-center"><Users className="mx-auto h-7 w-7 text-slate-400" /><h2 className="mt-3 font-semibold">No active trainer profiles found</h2><p className="mt-1 text-sm text-slate-600">Try another subject or ask an administrator to add trainer records.</p></section> : <div className="grid gap-4 lg:grid-cols-2">{trainers.map((trainer) => <article key={trainer.trainerId} className="surface p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{trainer.name} {trainer.isSample ? <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-900">sample</span> : null}</h2><p className="mt-1 text-sm text-slate-600">{trainer.designation || 'Designation not recorded'} · {trainer.department || 'Department not recorded'}</p><a className="mt-1 inline-block text-xs text-gov-blue hover:underline" href={`mailto:${trainer.email}`}>{trainer.email}</a></div><div className="min-w-20 rounded bg-blue-50 p-2 text-center"><strong className="block text-lg text-blue-950">{trainer.matchScore}</strong><span className="text-[10px] text-slate-600">profile match</span></div></div>
        <p className="mt-4 text-xs leading-5 text-slate-600">{trainer.evidenceSummary.platformRecordedCount} platform-recorded categories · {trainer.evidenceSummary.selfDeclaredCount} self-declared categories · {trainer.evidenceSummary.missingCount} categories without records</p>
        <div className="mt-4 grid grid-cols-2 gap-2">{evidenceLabels.map(([key, label]) => <div key={key} className="rounded border border-slate-200 p-2.5"><p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{trainer.breakdown[key].points}/{trainer.breakdown[key].maxPoints}</p></div>)}</div>
        <button type="button" className="button-secondary mt-4 text-xs" onClick={() => setSelected(trainer)}>Review evidence</button></article>)}</div>}
    {selected ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="trainer-dialog-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-md bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Evidence for {query}</p><h2 id="trainer-dialog-title" className="mt-1 text-lg font-semibold">{selected.name}</h2></div><button className="button-secondary text-xs" onClick={() => setSelected(null)}>Close</button></div><div className="mt-4 space-y-3">{evidenceLabels.map(([key, label]) => { const item = selected.breakdown[key]; return <article key={key} className="rounded border border-slate-200 p-3"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">{label}</h3><span className="text-xs text-slate-500">{item.evidenceType} · {item.weight}</span></div><p className="mt-1 text-sm text-slate-700">{item.summary}</p>{item.details.length ? <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</article>; })}</div><p className="mt-4 text-xs text-slate-500">Use these records as a starting point and verify qualifications and availability through your usual process.</p></section></div> : null}
  </main>;
}
