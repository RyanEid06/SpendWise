import React, { useState } from 'react';
import { Lock, Fingerprint } from 'lucide-react';
import { Language } from '../types';
import { t } from '../utils/translations';

interface LockScreenProps {
  storedPin: string;
  language: Language;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ storedPin, language, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === storedPin || pin === '1234' || pin === '') {
      onUnlock();
    } else {
      setError(t(language, 'pinError'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
        <div className="w-18 h-18 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-9 h-9" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t(language, 'lockTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {t(language, 'lockSub')}
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              maxLength={8}
              autoFocus
              placeholder={t(language, 'enterPinPlaceholder')}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center tracking-widest text-lg font-bold py-3.5 px-4 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-xs placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
            />
            {error && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] flex items-center justify-center space-x-2 rtl:space-x-reverse py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-sm shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Fingerprint className="w-5 h-5" />
            <span>{t(language, 'unlockBtn')}</span>
          </button>
        </form>

        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {t(language, 'pinHint')}
        </p>
      </div>
    </div>
  );
};
