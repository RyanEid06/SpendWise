import React, { useState } from 'react';
import type { Language } from '../../types';
import { diagnostics } from '../../services/diagnostics/diagnostics';
import { exportTechnicalDiagnostics } from '../../services/diagnostics/exportDiagnostics';

const copy = {
  en: { title: 'Technical diagnostics', description: 'Technical status and recent error codes only. Inspect the report before choosing to share it.', inspect: 'Inspect report', export: 'Export technical report', clear: 'Clear diagnostics', failed: 'The technical report could not be exported.' },
  fr: { title: 'Diagnostic technique', description: 'État technique et codes d’erreur récents uniquement. Consultez le rapport avant de choisir de le partager.', inspect: 'Voir le rapport', export: 'Exporter le rapport technique', clear: 'Effacer les diagnostics', failed: 'Le rapport technique n’a pas pu être exporté.' },
  ar: { title: 'التشخيص التقني', description: 'الحالة التقنية ورموز الأخطاء الحديثة فقط. راجع التقرير قبل اختيار مشاركته.', inspect: 'عرض التقرير', export: 'تصدير التقرير التقني', clear: 'مسح التشخيص', failed: 'تعذر تصدير التقرير التقني.' },
};

/** Available even when protected storage cannot open; never reads financial state. */
export function TechnicalDiagnostics({ language }: { language: Language }) {
  const text = copy[language];
  const [report, setReport] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const inspect = () => setReport(JSON.stringify(diagnostics.report(), null, 2));
  const clear = () => { diagnostics.clear(); if (report !== null) inspect(); };
  const exportReport = async () => {
    setExporting(true); setFailed(false);
    try { await exportTechnicalDiagnostics(); }
    catch { setFailed(true); }
    finally { setExporting(false); }
  };
  const buttonClass = 'min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold';
  return (
    <section dir={language === 'ar' ? 'rtl' : 'ltr'} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] p-4 space-y-3">
      <h2 className="text-sm font-bold">{text.title}</h2>
      <p className="text-xs text-slate-600 dark:text-slate-300">{text.description}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={inspect}>{text.inspect}</button>
        <button type="button" className={buttonClass} disabled={exporting} onClick={() => void exportReport()}>{text.export}</button>
        <button type="button" className={buttonClass} onClick={clear}>{text.clear}</button>
      </div>
      {failed && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{text.failed}</p>}
      {report !== null && <pre dir="ltr" aria-label={text.title} data-testid="technical-report" className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-100 dark:bg-slate-950 p-3 text-[11px]">{report}</pre>}
    </section>
  );
}
