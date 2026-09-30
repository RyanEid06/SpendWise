import React, { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Language } from '../types';
import { t } from '../utils/translations';
import {
  clearLockThrottle,
  readLockThrottleState,
  recordLockFailure,
  remainingLockDelayMs,
} from '../utils/lockThrottle';

interface LockScreenProps {
  storedPin: string;
  language: Language;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ storedPin, language, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const throttle = readLockThrottleState();
  const remainingMs = remainingLockDelayMs(throttle, now);
  const isThrottled = remainingMs > 0;
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (!isThrottled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isThrottled]);

  const throttleMessage = useMemo(() => {
    if (!isThrottled) return null;
    if (language === 'ar') return `محاولات كثيرة. حاول مجددًا بعد ${remainingSeconds} ثانية.`;
    if (language === 'fr') return `Trop de tentatives. Réessayez dans ${remainingSeconds} s.`;
    return `Too many attempts. Try again in ${remainingSeconds}s.`;
  }, [isThrottled, language, remainingSeconds]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentNow = Date.now();
    const state = readLockThrottleState();
    if (remainingLockDelayMs(state, currentNow) > 0) {
      setNow(currentNow);
      return;
    }

    if (/^\d{4,8}$/.test(pin) && pin === storedPin) {
      clearLockThrottle();
      setPin('');
      setError(null);
      onUnlock();
      return;
    }

    recordLockFailure(currentNow);
    setNow(currentNow);
    setPin('');
    setError(t(language, 'pinError'));
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
              inputMode="numeric"
              maxLength={8}
              autoFocus
              disabled={isThrottled}
              placeholder={t(language, 'enterPinPlaceholder')}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              className="w-full text-center tracking-widest text-lg font-bold py-3.5 px-4 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:text-xs placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner disabled:opacity-50"
            />
            {throttleMessage ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">{throttleMessage}</p>
            ) : error ? (
              <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{error}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isThrottled}
            className="w-full min-h-[48px] flex items-center justify-center py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-sm shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
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
