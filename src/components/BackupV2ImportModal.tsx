import React, { useState } from 'react';
import { ArchiveRestore, Image as ImageIcon, X } from 'lucide-react';
import type { Language } from '../types';
import type { BackupV2Preview } from '../utils/backupV2';
import { ViewportPortal } from './ViewportPortal';

const labels = {
  en: { title: 'Backup restore', data: 'Data only', media: 'Data + photos', expenses: 'Expenses', budgets: 'Budgets', photos: 'Photos', size: 'Photo size', mode: 'Mode', merge: 'Merge', replace: 'Replace', cancel: 'Cancel', warning: 'Replace fully validates and stages the backup before changing your current ledger.' },
  fr: { title: 'Restauration de sauvegarde', data: 'Données seules', media: 'Données + photos', expenses: 'Dépenses', budgets: 'Budgets', photos: 'Photos', size: 'Taille photos', mode: 'Mode', merge: 'Fusionner', replace: 'Remplacer', cancel: 'Annuler', warning: 'Le remplacement valide et prépare entièrement la sauvegarde avant de modifier le registre actuel.' },
  ar: { title: 'استعادة النسخة الاحتياطية', data: 'بيانات فقط', media: 'بيانات + صور', expenses: 'المصاريف', budgets: 'الميزانيات', photos: 'الصور', size: 'حجم الصور', mode: 'الوضع', merge: 'دمج', replace: 'استبدال', cancel: 'إلغاء', warning: 'يتم التحقق من النسخة وتجهيزها بالكامل قبل تغيير السجل الحالي.' },
} as const;

function bytes(value: number) {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export const BackupV2ImportModal: React.FC<{
  preview: BackupV2Preview | Omit<BackupV2Preview, 'schemaVersion'> & { schemaVersion: 3 };
  version?: 2 | 3;
  language: Language;
  onConfirm: (replace: boolean) => void;
  onClose: () => void;
}> = ({ preview, version = preview.schemaVersion, language, onConfirm, onClose }) => {
  const text = labels[language];
  const [replace, setReplace] = useState(false);
  return (
    <ViewportPortal>
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="backup-restore-title">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
          <div id="backup-restore-title" className="flex items-center gap-2 font-bold"><ArchiveRestore className="w-5 h-5" />{text.title} v{version}</div>
          <button type="button" onClick={onClose} className="min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label={text.cancel}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-2">
            <div className="flex justify-between"><span>{text.expenses}</span><b>{preview.totalExpenses}</b></div>
            <div className="flex justify-between"><span>{text.budgets}</span><b>{preview.totalBudgets}</b></div>
            <div className="flex justify-between"><span>{text.photos}</span><b>{preview.totalAttachments}</b></div>
            <div className="flex justify-between"><span>{text.size}</span><b>{bytes(preview.mediaBytes)}</b></div>
            <div className="flex justify-between"><span>{text.mode}</span><b className="flex items-center gap-1">{preview.mediaIncluded && <ImageIcon className="w-3 h-3" />}{preview.mediaIncluded ? text.media : text.data}</b></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setReplace(false)} className={`min-h-[48px] rounded-2xl border font-bold text-xs ${!replace ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800'}`}>{text.merge}</button>
            <button type="button" onClick={() => setReplace(true)} className={`min-h-[48px] rounded-2xl border font-bold text-xs ${replace ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'border-slate-200 dark:border-slate-800'}`}>{text.replace}</button>
          </div>
          {replace && <div className="text-xs p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200">{text.warning}</div>}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[48px] px-4 rounded-xl text-sm font-bold">{text.cancel}</button>
          <button type="button" onClick={() => onConfirm(replace)} className={`min-h-[48px] px-5 rounded-xl text-sm font-extrabold ${replace ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'}`}>{replace ? text.replace : text.merge}</button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
};
