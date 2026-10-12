import React from 'react';
import type { Language } from '../types';
import { backupRestoreCopy } from '../features/backup/restoreCopy';

export const RestorePreferencesControl: React.FC<{
  language: Language;
  replace: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ language, replace, checked, onChange }) => {
  const copy = backupRestoreCopy[language];
  return (
    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
      <p>{replace ? copy.keepPreferences : copy.mergePreferences}</p>
      {replace && (
        <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 accent-emerald-600" />
          <span>
            <span className="block font-bold text-slate-900 dark:text-white">{copy.restorePreferences}</span>
            <span className="block mt-1 leading-relaxed">{copy.restorePreferencesHint}</span>
          </span>
        </label>
      )}
    </div>
  );
};
