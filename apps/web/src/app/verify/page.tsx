'use client';

import React, { useState } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle } from 'lucide-react';

export default function VerifyCertificatePage() {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/verify/${encodeURIComponent(serial.trim())}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data.data);
      } else {
        setError(data.message || 'No matching training record was found in this application.');
      }
    } catch (err) {
      setError('Failed to reach validation service. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Training Record Lookup
        </h1>
        <p className="text-slate-600 text-sm max-w-xl mx-auto">
          Check whether a training record exists in this Capacity Connect instance. A matching record does not independently accredit the course or issuing organization.
        </p>
      </div>

      {/* Verification Input Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleVerify} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-700">
            ENTER TRAINING RECORD SERIAL NUMBER
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. CC-2026-A1B2C3D4"
              className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-gov-accent focus:border-gov-accent font-mono uppercase"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-gov-navy hover:bg-gov-dark text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching…' : 'Look up record'}
            </button>
          </div>
          <span className="text-[11px] text-slate-400 block">
            Use the serial number shown on the record or its QR code.
          </span>
        </form>

        {/* Verification Success Display */}
        {result && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 tracking-wide uppercase">
                    Record found
                  </span>
                  <span className="text-[11px] font-mono bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded font-bold">
                    {result.serialNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Recipient Name:</span>
                    <span className="font-bold text-slate-800 text-sm">{result.recipientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Course / Qualification:</span>
                    <span className="font-bold text-slate-800 text-sm">{result.courseTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Issuer configured for this instance:</span>
                    <span className="font-medium text-slate-800">{result.organization}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date of Issue:</span>
                    <span className="font-medium text-slate-800">
                      {new Date(result.issueDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 border-t border-emerald-200/60 pt-2 font-mono break-all">
                  Record reference hash: {result.verifyHash}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verification Error Display */}
        {error && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-rose-800 block">Verification Unsuccessful</span>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
