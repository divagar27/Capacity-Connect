'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { apiRequest, ApiError } from '../../../lib/api';

type Option = { id: string; text: string };
type Question = { id: string; prompt: string; topicTag?: string; points: number; options: Option[] };
type StartResponse = { attemptId: string; endsAt: string; title: string; courseId?: string | null; answers?: { questionId: string; selectedOptionId: string }[]; questions: Question[] };
type Review = { questionId: string; prompt: string; topicTag: string; selectedOptionId: string | null; correctOptionId: string | null; isCorrect: boolean; options: Option[] };
type Result = { score: number; isPassed: boolean; status: string; passMark: number; submittedAt: string; correctCount: number; totalQuestions: number; review: Review[]; improvementSuggestions: string[] };

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [test, setTest] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const submitLock = useRef(false);

  useEffect(() => {
    let active = true;
    apiRequest<StartResponse>(`tests/${id}/start`, { method: 'POST' }).then((response) => {
      if (!active) return;
      setTest(response);
      setAnswers(Object.fromEntries((response.answers || []).map((answer) => [answer.questionId, answer.selectedOptionId])));
      setRemaining(Math.max(0, Math.floor((new Date(response.endsAt).getTime() - Date.now()) / 1000)));
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) router.replace(`/auth/login?redirect=/tests/${id}`);
      else setError(reason instanceof Error ? reason.message : 'Assessment could not be started.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, router]);

  const submit = useCallback(async (automatic = false) => {
    if (!test || submitLock.current) return;
    if (!automatic) {
      const count = Object.keys(answers).length;
      if (count < test.questions.length && !window.confirm(`You answered ${count} of ${test.questions.length} questions. Submit anyway?`)) return;
    }
    submitLock.current = true; setSubmitting(true); setError('');
    try { setResult(await apiRequest<Result>(`tests/attempts/${test.attemptId}/submit`, { method: 'POST' })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Assessment submission failed.'); submitLock.current = false; }
    finally { setSubmitting(false); }
  }, [answers, test]);

  useEffect(() => {
    if (!test || result) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(test.endsAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submit(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [result, submit, test]);

  async function choose(questionId: string, selectedOptionId: string) {
    if (!test || submitting) return;
    const previous = answers[questionId];
    setAnswers((current) => ({ ...current, [questionId]: selectedOptionId })); setSaving(true); setError('');
    try {
      await apiRequest(`tests/attempts/${test.attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ answers: [{ questionId, selectedOptionId }] }) });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (reason) {
      setAnswers((current) => { const next = { ...current }; if (previous) next[questionId] = previous; else delete next[questionId]; return next; });
      setError(reason instanceof Error ? reason.message : 'Answer could not be saved.');
    } finally { setSaving(false); }
  }

  if (loading) return <main className="page-container py-16 text-center text-sm text-slate-600"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Starting assessment…</main>;
  if (result) return <main className="page-container space-y-5 py-9"><section className="surface mx-auto max-w-3xl p-6 sm:p-8">
    <div className="text-center"><div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${result.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{result.isPassed ? <CheckCircle2 /> : <XCircle />}</div><p className="eyebrow mt-4">Assessment result</p><h1 className="mt-1 text-2xl font-semibold">{result.isPassed ? 'Passed' : 'Not passed'}</h1><p className="mt-2 text-sm text-slate-600">{result.correctCount} correct out of {result.totalQuestions} · {result.score}% · pass mark {result.passMark}%</p></div>
    {result.improvementSuggestions?.length ? <div className="mt-6 rounded-md bg-blue-50 p-4"><h2 className="text-sm font-semibold">Topics to review</h2><ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{result.improvementSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div> : null}
    <div className="mt-6 space-y-3"><h2 className="text-sm font-semibold">Answer review</h2>{result.review?.map((item, index) => <article key={item.questionId} className="rounded-md border border-slate-200 p-4"><p className="text-sm font-medium">{index + 1}. {item.prompt}</p><p className={`mt-2 text-xs font-semibold ${item.isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>{item.isCorrect ? 'Correct' : 'Review this question'}{item.topicTag ? ` · ${item.topicTag}` : ''}</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{item.options.map((option) => <li key={option.id} className={option.id === item.correctOptionId ? 'font-semibold text-emerald-800' : option.id === item.selectedOptionId ? 'text-rose-800' : ''}>{option.text}{option.id === item.correctOptionId ? ' · correct answer' : option.id === item.selectedOptionId ? ' · your answer' : ''}</li>)}</ul></article>)}</div>
    <div className="mt-6 flex justify-center"><Link className="button-primary text-xs" href={test?.courseId ? `/courses/${test.courseId}` : '/portal/trainee'}><ArrowLeft className="h-4 w-4" />Return to course</Link></div>
  </section></main>;
  if (!test) return <main className="page-container py-12"><section role="alert" className="surface mx-auto max-w-xl p-6 text-center"><AlertCircle className="mx-auto h-8 w-8 text-rose-700" /><h1 className="mt-3 font-semibold">Assessment unavailable</h1><p className="mt-2 text-sm text-slate-600">{error}</p><Link href="/portal/trainee" className="button-secondary mt-4 text-xs">Back to learning workspace</Link></section></main>;

  const minutes = Math.floor(remaining / 60); const seconds = remaining % 60;
  return <main className="page-container space-y-5 py-7">
    <header className="sticky top-16 z-20 flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Timed assessment</p><h1 className="mt-1 text-lg font-semibold">{test.title}</h1><p className="mt-1 text-xs text-slate-500">{saving ? 'Saving answer…' : savedAt ? `Last saved ${savedAt}` : 'Answers save as you choose them'}</p></div><div className="flex items-center gap-3"><p aria-live="off" className={`inline-flex items-center gap-2 rounded px-3 py-2 font-mono text-sm font-semibold ${remaining < 60 ? 'bg-rose-50 text-rose-800' : 'bg-slate-100 text-slate-800'}`}><Clock3 className="h-4 w-4" />{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</p><button type="button" className="button-primary text-xs" disabled={submitting || saving} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit answers'}</button></div></header>
    {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    <div className="space-y-4">{test.questions.map((question, index) => <fieldset key={question.id} className="surface p-5"><legend className="sr-only">Question {index + 1}</legend><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-gov-blue">Question {index + 1} of {test.questions.length}</span><span className="text-xs text-slate-500">{question.points} points{question.topicTag ? ` · ${question.topicTag}` : ''}</span></div><p className="mt-3 text-sm font-medium leading-6 text-slate-900">{question.prompt}</p><div className="mt-3 space-y-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm hover:bg-slate-50 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => void choose(question.id, option.id)} className="mt-0.5" /><span>{option.text}</span></label>)}</div></fieldset>)}</div>
  </main>;
}
