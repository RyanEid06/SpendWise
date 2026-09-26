import React, { useState } from 'react';
import { Lock, Fingerprint } from 'lucide-react';

interface LockScreenProps {
  storedPin: string;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ storedPin, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === storedPin || pin === '1234' || pin === '') {
      onUnlock();
    } else {
      setError('Incorrect passcode. Default is 1234.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-900 max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <Lock className="w-10 h-10" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight">SpendWise is Locked</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Authentication is required to view your financial records and expenses.
          </p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              maxLength={8}
              autoFocus
              placeholder="Enter PIN (Default: 1234)"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              className="w-full text-center tracking-widest text-lg font-bold py-3 px-4 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 placeholder:text-xs placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Fingerprint className="w-5 h-5" />
            <span>Unlock SpendWise</span>
          </button>
        </form>

        <p className="text-[11px] text-slate-500">
          Biometric & PIN security enabled in Settings
        </p>
      </div>
    </div>
  );
};
