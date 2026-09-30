import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, HardDrive, Image as ImageIcon, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { ExpenseAttachment, Language } from '../types';
import { AttachmentStorage } from '../utils/attachmentStorage';
import type { MediaIntegrityReport } from '../utils/mediaIntegrity';
import { StorageManager } from '../utils/storage';
import { exportBlobFile } from '../utils/fileExport';
import { formatDate } from '../utils/date';
import { ViewportPortal } from '../components/ViewportPortal';
import { useSensitivePrivacySurface } from '../app/hooks/useSensitivePrivacySurface';

const copy = {
  en: {
    title: 'Media Library', sub: 'Photos stored privately by SpendWise', back: 'Back',
    photos: 'photos', storage: 'Photo storage', healthy: 'Media integrity looks good',
    issues: 'integrity issues', repair: 'Repair safe issues', repaired: 'Safe repair completed',
    empty: 'No SpendWise photos yet', emptySub: 'Photos attached to expenses will appear here.',
    purchase: 'Purchase', receipt: 'Receipt', proof: 'Proof', linked: 'Linked expense',
    created: 'Added', size: 'File size', dimensions: 'Dimensions', export: 'Share / export',
    close: 'Close', unknown: 'Unknown expense', date: 'Date', shareTitle: 'SpendWise photo',
  },
  fr: {
    title: 'Médiathèque', sub: 'Photos conservées en privé par SpendWise', back: 'Retour',
    photos: 'photos', storage: 'Stockage photos', healthy: 'Intégrité des médias correcte',
    issues: 'problèmes d’intégrité', repair: 'Réparer les problèmes sûrs', repaired: 'Réparation sûre terminée',
    empty: 'Aucune photo SpendWise', emptySub: 'Les photos jointes aux dépenses apparaîtront ici.',
    purchase: 'Achat', receipt: 'Reçu', proof: 'Preuve', linked: 'Dépense liée',
    created: 'Ajoutée', size: 'Taille du fichier', dimensions: 'Dimensions', export: 'Partager / exporter',
    close: 'Fermer', unknown: 'Dépense inconnue', date: 'Date', shareTitle: 'Photo SpendWise',
  },
  ar: {
    title: 'مكتبة الوسائط', sub: 'الصور المحفوظة بشكل خاص داخل SpendWise', back: 'رجوع',
    photos: 'صور', storage: 'مساحة الصور', healthy: 'سلامة الوسائط جيدة',
    issues: 'مشكلات سلامة', repair: 'إصلاح المشكلات الآمنة', repaired: 'اكتمل الإصلاح الآمن',
    empty: 'لا توجد صور SpendWise بعد', emptySub: 'ستظهر هنا الصور المرفقة بالمصاريف.',
    purchase: 'شراء', receipt: 'إيصال', proof: 'إثبات', linked: 'المصروف المرتبط',
    created: 'أضيفت', size: 'حجم الملف', dimensions: 'الأبعاد', export: 'مشاركة / تصدير',
    close: 'إغلاق', unknown: 'مصروف غير معروف', date: 'التاريخ', shareTitle: 'صورة SpendWise',
  },
} as const;

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LazyAttachmentImage: React.FC<{ item: ExpenseAttachment; className: string }> = ({ item, className }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let url: string | null = null;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void AttachmentStorage.readAttachmentUrl(item).then((value) => {
        if (disposed) {
          AttachmentStorage.revokePreviewUrl(value);
          return;
        }
        url = value;
        setSrc(value);
      }).catch(() => setSrc(null));
    }, { rootMargin: '160px' });
    observer.observe(host);
    return () => {
      disposed = true;
      observer.disconnect();
      AttachmentStorage.revokePreviewUrl(url);
    };
  }, [item.id, item.storageKey]);

  return (
    <div ref={hostRef} className={`bg-slate-100 dark:bg-slate-900 overflow-hidden ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> :
        <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="w-6 h-6" /></div>}
    </div>
  );
};

export const MediaLibraryScreen: React.FC<{ language: Language; onClose: () => void }> = ({ language, onClose }) => {
  useSensitivePrivacySurface();
  const text = copy[language];
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [report, setReport] = useState<MediaIntegrityReport | null>(null);
  const [selected, setSelected] = useState<ExpenseAttachment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const expenses = useMemo(() => StorageManager.getExpenses(), [attachments]);

  const refresh = async () => {
    setAttachments(AttachmentStorage.getAllAttachments().sort((a, b) => b.createdAt - a.createdAt));
    setReport(await AttachmentStorage.auditIntegrity());
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const handler = () => selected ? setSelected(null) : onClose();
    window.addEventListener('spendwise-native-back', handler);
    return () => window.removeEventListener('spendwise-native-back', handler);
  }, [selected, onClose]);

  const selectedExpense = selected ? expenses.find((expense) => expense.id === selected.expenseId) : null;

  const shareSelected = async () => {
    if (!selected) return;
    const blob = await AttachmentStorage.readAttachmentBlob(selected);
    await exportBlobFile({
      fileName: selected.originalFilename?.toLowerCase().endsWith('.jpg') ? selected.originalFilename : `spendwise-photo-${selected.id}.jpg`,
      blob,
      shareTitle: text.shareTitle,
    });
  };

  return (
    <div className="space-y-4 pb-28 animate-screen-enter" data-native-back-layer="true">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="min-w-[48px] min-h-[48px] rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center" aria-label={text.back}>
          <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{text.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{text.sub}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] p-3">
          <div className="text-xs text-slate-500">{text.photos}</div>
          <div className="text-lg font-extrabold">{attachments.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] p-3">
          <div className="text-xs text-slate-500">{text.storage}</div>
          <div className="text-lg font-extrabold">{humanBytes(report?.totalBinaryBytes || 0)}</div>
        </div>
      </div>

      {report && (
        <div className={`rounded-2xl border p-3 text-xs flex items-center justify-between gap-3 ${report.healthy ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{report.healthy ? text.healthy : `${report.issues.length} ${text.issues}`}</span>
          </div>
          {!report.healthy && (
            <button type="button" onClick={async () => {
              await AttachmentStorage.repairIntegrity();
              setMessage(text.repaired);
              await refresh();
            }} className="min-h-[48px] px-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />{text.repair}
            </button>
          )}
        </div>
      )}

      {message && <div className="text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">{message}</div>}

      {attachments.length === 0 ? (
        <div className="py-14 text-center space-y-2">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
          <div className="font-bold">{text.empty}</div>
          <div className="text-xs text-slate-500">{text.emptySub}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((item) => {
            const expense = expenses.find((value) => value.id === item.expenseId);
            return (
              <button key={item.id} type="button" onClick={() => setSelected(item)}
                className="text-left rtl:text-right rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] active:scale-[0.99]">
                <LazyAttachmentImage item={item} className="aspect-square" />
                <div className="p-2.5 space-y-1">
                  <div className="text-xs font-bold truncate">{expense?.description || text.unknown}</div>
                  <div className="text-[10px] text-slate-500 flex justify-between gap-1">
                    <span>{text[item.kind]}</span><span>{humanBytes(item.byteSize)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ViewportPortal>
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111928] overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="font-bold text-sm">{selectedExpense?.description || text.unknown}</div>
              <button type="button" onClick={() => setSelected(null)} className="min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label={text.close}><X className="w-5 h-5" /></button>
            </div>
            <LazyAttachmentImage item={selected} className="aspect-square" />
            <div className="p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">{text.linked}</span><span>{selectedExpense?.description || text.unknown}</span></div>
              {selectedExpense && <div className="flex justify-between"><span className="text-slate-500">{text.date}</span><span>{formatDate(selectedExpense.date)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">{text.created}</span><span>{formatDate(selected.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{text.size}</span><span>{humanBytes(selected.byteSize)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{text.dimensions}</span><span>{selected.width} × {selected.height}</span></div>
              <button type="button" onClick={() => void shareSelected()} className="w-full min-h-[48px] rounded-2xl bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center gap-2 mt-3">
                <Download className="w-4 h-4" />{text.export}
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
};
