'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { Globe } from 'lucide-react';

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export function AccessibilityBar() {
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const [currentLang, setCurrentLang] = useState<'en' | 'hi' | 'mr'>('en');

  const changeFontSize = (delta: number) => {
    const newLevel = Math.max(-1, Math.min(2, fontSizeLevel + delta));
    setFontSizeLevel(newLevel);
    const html = document.documentElement;
    if (newLevel === -1) html.style.fontSize = '14px';
    else if (newLevel === 0) html.style.fontSize = '16px';
    else if (newLevel === 1) html.style.fontSize = '18px';
    else if (newLevel === 2) html.style.fontSize = '20px';
  };

  useEffect(() => {
    // 1. Determine active language from cookie or localStorage
    const saved = localStorage.getItem('capacity_connect_lang') as 'en' | 'hi' | 'mr' | null;
    const match = document.cookie.match(/googtrans=\/en\/([a-zA-Z]+)/);
    
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
      setCurrentLang(saved);
    } else if (match && match[1] && (match[1] === 'en' || match[1] === 'hi' || match[1] === 'mr')) {
      setCurrentLang(match[1] as any);
    }

    // 2. Google Translate Init Handler
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi,mr',
            autoDisplay: false,
          },
          'google_translate_element'
        );
      }
    };
  }, []);

  const triggerGoogleTranslate = (langCode: 'en' | 'hi' | 'mr') => {
    setCurrentLang(langCode);
    localStorage.setItem('capacity_connect_lang', langCode);

    const domain = window.location.hostname;

    if (langCode === 'en') {
      // Revert completely to English: delete googtrans cookies
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${domain}; path=/;`;
      document.cookie = 'googtrans=/en/en; path=/;';
      document.cookie = `googtrans=/en/en; domain=.${domain}; path=/;`;
    } else {
      // Set target language
      document.cookie = `googtrans=/en/${langCode}; path=/;`;
      document.cookie = `googtrans=/en/${langCode}; domain=.${domain}; path=/;`;
    }

    // Trigger select dropdown if already mounted
    const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      {/* Google Translate Script */}
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />

      <div className="bg-slate-950 text-slate-200 py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Government Masthead Line */}
          <div className="flex items-center gap-2.5 text-xs text-slate-300 tracking-wider">
            <span className="font-bold text-slate-200">
              भारत सरकार | GOVERNMENT OF INDIA
            </span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:inline text-slate-400 font-medium">
              पृथ्वी विज्ञान मंत्रालय | Ministry of Earth Sciences
            </span>
          </div>

          {/* Accessibility & Color-Coded Language Selector */}
          <div className="flex items-center gap-4">
            {/* Prominent Color-Coded Language Segmented Control */}
            <div className="inline-flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-700 shadow-sm">
              <span className="text-xs text-slate-400 font-medium px-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="hidden sm:inline font-semibold">Language:</span>
              </span>

              {/* English: Royal Sapphire Blue */}
              <button
                type="button"
                onClick={() => triggerGoogleTranslate('en')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  currentLang === 'en'
                    ? 'bg-blue-600 text-white shadow-md scale-105 ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Revert to original English"
              >
                <span>English</span>
              </button>

              {/* Hindi: Vibrant Saffron Amber */}
              <button
                type="button"
                onClick={() => triggerGoogleTranslate('hi')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  currentLang === 'hi'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md scale-105 ring-1 ring-amber-400'
                    : 'text-amber-300 hover:text-amber-100 hover:bg-slate-800'
                }`}
                title="हिन्दी में अनुवाद करें"
              >
                <span>हिन्दी</span>
              </button>

              {/* Marathi: Emerald Forest Green */}
              <button
                type="button"
                onClick={() => triggerGoogleTranslate('mr')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  currentLang === 'mr'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md scale-105 ring-1 ring-emerald-400'
                    : 'text-emerald-300 hover:text-emerald-100 hover:bg-slate-800'
                }`}
                title="मराठीत भाषांतर करा"
              >
                <span>मराठी</span>
              </button>
            </div>

            {/* Completely hidden translate mount point */}
            <div id="google_translate_element" aria-hidden="true" style={{ display: 'none' }} />

            {/* Text Zoom Controls */}
            <div className="hidden lg:flex items-center gap-1 border-l border-slate-800 pl-3 text-xs">
              <span className="text-[11px] text-slate-400 mr-1">Text:</span>
              <button
                onClick={() => changeFontSize(-1)}
                className="w-6 h-6 rounded hover:bg-slate-800 font-bold flex items-center justify-center text-xs text-slate-300"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <button
                onClick={() => changeFontSize(0 - fontSizeLevel)}
                className="w-6 h-6 rounded hover:bg-slate-800 font-bold flex items-center justify-center text-xs text-slate-300"
                aria-label="Reset font size"
              >
                A
              </button>
              <button
                onClick={() => changeFontSize(1)}
                className="w-6 h-6 rounded hover:bg-slate-800 font-bold flex items-center justify-center text-xs text-slate-300"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            {/* Hackathon Badge */}
            <span className="text-[10px] font-mono font-bold bg-amber-400/10 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
              SIH-26075
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
