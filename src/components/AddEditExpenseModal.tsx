import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DraftToolState, ExpenseEditorDraft } from '../data/ExpenseDraft';
import { expenseDraftRecoveryService } from '../services/ExpenseDraftRecoveryService';
import { ChevronDown, ImagePlus, ReceiptText, Sparkles, X } from 'lucide-react';
import { Expense, Language, ReceiptScanResult, SmartCaptureResult } from '../types';
import { DEFAULT_CATEGORIES, normalizeCategoryName } from '../utils/categories';
import { getCurrency } from '../utils/currency';
import { fromInputDateFormat, toInputDateFormat } from '../utils/date';
import { getLocalizedCategoryName, t } from '../utils/translations';
import { ExpenseAttachmentsEditor } from './ExpenseAttachmentsEditor';
import {
  AttachmentDraft,
  AttachmentEditPayload,
  AttachmentStorage,
  MAX_ATTACHMENTS_PER_EXPENSE,
} from '../utils/attachmentStorage';
import { ta } from '../utils/attachmentTranslations';
import { SmartCaptureCard } from './SmartCaptureCard';
import { ReceiptScanCard } from './ReceiptScanCard';
import { ViewportPortal } from './ViewportPortal';
import { RetainedScreen } from './RetainedScreen';
import { useVisualViewport } from './useVisualViewport';
import { useModalFocus } from './useModalFocus';

interface AddEditExpenseModalProps {
  recoveryDraft?: ExpenseEditorDraft | null;
  protectDraft?: boolean;
  isOpen: boolean;
  initialExpense?: Expense | null;
  defaultDate?: number;
  currencyCode: string;
  language: Language;
  onSave: (
    amount: number,
    description: string,
    category: string,
    date: number,
    note: string | null,
    attachmentChanges: AttachmentEditPayload
  ) => void | Promise<void>;
  onClose: () => void;
}

type OptionalTool = 'smart' | 'receipt' | 'photos' | null;

const OPTIONAL_COPY = {
  en: {
    title: 'Optional tools',
    sub: 'Manual entry stays simple. Open only the tool you need.',
    smart: 'Smart Capture',
    receipt: 'Scan Receipt',
    photos: 'Attach Photos',
  },
  fr: {
    title: 'Outils facultatifs',
    sub: 'La saisie manuelle reste simple. Ouvrez uniquement l’outil nécessaire.',
    smart: 'Capture intelligente',
    receipt: 'Scanner un reçu',
    photos: 'Joindre des photos',
  },
  ar: {
    title: 'أدوات اختيارية',
    sub: 'يبقى الإدخال اليدوي بسيطاً. افتح الأداة التي تحتاجها فقط.',
    smart: 'التقاط ذكي',
    receipt: 'مسح الإيصال',
    photos: 'إرفاق صور',
  },
} as const;

export const AddEditExpenseModal: React.FC<AddEditExpenseModalProps> = ({
  isOpen,
  initialExpense,
  defaultDate = Date.now(),
  currencyCode,
  language,
  onSave,
  onClose,
  recoveryDraft,
  protectDraft = true,
}) => {
  if (!isOpen) return null;

  const currency = getCurrency(currencyCode);
  const viewport = useVisualViewport();
  const dialogRef = useModalFocus('#modal-title');
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const optionalCopy = OPTIONAL_COPY[language];
  const [amountText, setAmountText] = useState(
    recoveryDraft?.amountText ?? (initialExpense ? initialExpense.amount.toString() : '')
  );
  const [descriptionText, setDescriptionText] = useState(recoveryDraft?.descriptionText ?? initialExpense?.description ?? '');
  const [selectedCategory, setSelectedCategory] = useState(
    normalizeCategoryName(recoveryDraft?.category ?? initialExpense?.category ?? DEFAULT_CATEGORIES[0].name)
  );
  const [selectedDateMillis, setSelectedDateMillis] = useState<number>(
    recoveryDraft?.date ?? initialExpense?.date ?? defaultDate
  );
  const [noteText, setNoteText] = useState(recoveryDraft?.noteText ?? initialExpense?.note ?? '');
  const [activeTool, setActiveTool] = useState<OptionalTool>(recoveryDraft?.activeTool ?? null);

  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>(recoveryDraft?.attachments ?? []);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>(recoveryDraft?.removedAttachmentIds ?? []);
  const [smartDraft, setSmartDraft] = useState<DraftToolState<SmartCaptureResult> | null>(recoveryDraft?.smart ?? null);
  const [receiptDraft, setReceiptDraft] = useState<DraftToolState<ReceiptScanResult> | null>(recoveryDraft?.receipt ?? null);
  const [draftId] = useState(() => recoveryDraft?.id ?? crypto.randomUUID());
  const terminal = useRef(false);
  const writeSequence = useRef(0);
  const [draftStatus, setDraftStatus] = useState<'saving' | 'protected' | 'error'>('saving');
  const [isSaving, setIsSaving] = useState(false);
  const [smartCapturePreparing, setSmartCapturePreparing] = useState(false);
  const [receiptPreparing, setReceiptPreparing] = useState(false);
  const [attachmentsPreparing, setAttachmentsPreparing] = useState(false);
  const [acquisitionPending, setAcquisitionPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isPhotoPreparing = acquisitionPending || smartCapturePreparing || receiptPreparing || attachmentsPreparing;
  const visibleDraftStatus = isPhotoPreparing ? 'saving' : draftStatus;

  const persistedAttachmentCount = useMemo(() => {
    if (!initialExpense) return 0;
    return AttachmentStorage.getAttachmentsForExpense(initialExpense.id).filter(
      (item) => !removedAttachmentIds.includes(item.id)
    ).length;
  }, [initialExpense, removedAttachmentIds]);

  const visiblePhotoCount = persistedAttachmentCount + attachmentDrafts.length;

  const snapshot = useMemo<ExpenseEditorDraft>(() => ({
    version: 1, id: draftId, expenseId: initialExpense?.id ?? null,
    expenseCreatedAt: initialExpense?.createdAt ?? null, currencyCode,
    amountText, descriptionText, category: selectedCategory, date: selectedDateMillis,
    noteText, activeTool, attachments: attachmentDrafts, removedAttachmentIds,
    smart: smartDraft, receipt: receiptDraft,
  }), [draftId, initialExpense, currencyCode, amountText, descriptionText, selectedCategory,
    selectedDateMillis, noteText, activeTool, attachmentDrafts, removedAttachmentIds, smartDraft, receiptDraft]);

  const protectAcquisition = (target: 'photos' | 'smart' | 'receipt') => protectDraft
    ? async (operation: () => Promise<AttachmentDraft[]>, accept?: () => boolean) => {
      setAcquisitionPending(true);
      try { return await expenseDraftRecoveryService.acquire(snapshot, target, language, operation, accept); }
      finally { setAcquisitionPending(false); }
    }
    : undefined;

  useLayoutEffect(() => {
    if (!protectDraft || terminal.current) return;
    const sequence = ++writeSequence.current;
    setDraftStatus('saving');
    void expenseDraftRecoveryService.persist(snapshot).then(() => {
      if (sequence === writeSequence.current && !terminal.current) setDraftStatus('protected');
    }, () => {
      if (sequence === writeSequence.current && !terminal.current) setDraftStatus('error');
    });
  }, [snapshot, protectDraft]);

  const discardAndClose = async () => {
    if (isSaving || isPhotoPreparing || terminal.current) return;
    terminal.current = true;
    setIsSaving(true);
    try {
      if (protectDraft) await expenseDraftRecoveryService.discard(draftId);
      onClose();
    } catch {
      terminal.current = false;
      setSaveError(ta(language, 'attachmentSaveError'));
    } finally { setIsSaving(false); }
  };

  useEffect(() => {
    const closeIfSafe = () => {
      if (isSaving || isPhotoPreparing) return;
      void discardAndClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeIfSafe();
    };
    const handleNativeBack = () => closeIfSafe();
    document.addEventListener('keydown', handleKey);
    window.addEventListener('spendwise-native-back', handleNativeBack);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('spendwise-native-back', handleNativeBack);
    };
  }, [isSaving, isPhotoPreparing, onClose, draftId, protectDraft]);

  const revealAppliedDraft = () => {
    setSuggestionApplied(true);
    setActiveTool(null);
    requestAnimationFrame(() => {
      descriptionRef.current?.focus({ preventScroll: true });
      descriptionRef.current?.scrollIntoView({ block: 'center' });
    });
  };

  const handleReceiptScanApply = (extracted: ReceiptScanResult) => {
    if (extracted.totalAmount != null && extracted.totalAmount > 0) {
      setAmountText(extracted.totalAmount.toString());
      setAmountError(null);
    }
    if (extracted.merchant) {
      setDescriptionText(extracted.merchant);
      setDescriptionError(null);
    }
    if (extracted.category && DEFAULT_CATEGORIES.some((c) => c.name === extracted.category)) {
      setSelectedCategory(extracted.category);
    }
    if (extracted.dateMillis != null) {
      setSelectedDateMillis(extracted.dateMillis);
    }
    if (extracted.notesSummary) {
      setNoteText((current) => {
        const note = extracted.notesSummary!.trim();
        if (!note) return current;
        if (!current.trim()) return note;
        if (current.includes(note)) return current;
        return `${current.trim()}\n${note}`;
      });
    }
    revealAppliedDraft();
  };

  const handleSmartCaptureApply = (
    result: SmartCaptureResult,
    attachment: AttachmentDraft | null
  ) => {
    if (result.amount != null && result.amount > 0) {
      setAmountText(result.amount.toString());
      setAmountError(null);
    }

    const suggestedDescription =
      result.description &&
      result.merchantOrBrand &&
      !result.description.toLowerCase().includes(result.merchantOrBrand.toLowerCase())
        ? `${result.description} (${result.merchantOrBrand})`
        : result.description || result.merchantOrBrand;

    if (suggestedDescription) {
      setDescriptionText(suggestedDescription);
      setDescriptionError(null);
    }

    if (DEFAULT_CATEGORIES.some((category) => category.name === result.category)) {
      setSelectedCategory(result.category);
    } else {
      setSelectedCategory('Other');
    }

    if (result.notes) {
      setNoteText((current) => {
        const note = result.notes!.trim();
        if (!note) return current;
        if (!current.trim()) return note;
        if (current.includes(note)) return current;
        return `${current.trim()}\n${note}`;
      });
    }

    if (attachment && visiblePhotoCount < MAX_ATTACHMENTS_PER_EXPENSE) {
      setAttachmentDrafts((current) => current.includes(attachment) ? current : current.concat(attachment));
    }
    revealAppliedDraft();
  };

  const handleSave = async () => {
    let hasError = false;
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      setAmountError(t(language, 'amountError'));
      hasError = true;
    }

    if (!descriptionText.trim()) {
      setDescriptionError(t(language, 'descriptionError'));
      hasError = true;
    }

    if (hasError || isNaN(amount) || isSaving || isPhotoPreparing || terminal.current) return;

    setIsSaving(true);
    terminal.current = true;
    setSaveError(null);

    try {
      const save = async () => { await onSave(
        amount,
        descriptionText.trim(),
        selectedCategory,
        selectedDateMillis,
        noteText.trim() || null,
        {
          newAttachments: attachmentDrafts,
          removedAttachmentIds,
          recoveryDraftId: protectDraft ? draftId : undefined,
        }
      ); };
      if (protectDraft) await expenseDraftRecoveryService.commit(snapshot, save);
      else await save();
    } catch {
      terminal.current = false;
      setSaveError(ta(language, 'attachmentSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTool = (tool: Exclude<OptionalTool, null>) => {
    setActiveTool((current) => (current === tool ? null : tool));
  };

  return (
    <ViewportPortal>
      <div
        className="fixed inset-x-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
        style={{ height: viewport.height, top: viewport.top }}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-native-back-layer="true"
      >
        <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-full flex flex-col transition-colors">
          <div className="shrink-0 flex items-start justify-between gap-2 px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800">
            <div className="min-w-0">
              <h2
                id="modal-title"
                tabIndex={-1}
                className="text-lg font-bold text-slate-900 dark:text-white leading-tight [overflow-wrap:anywhere]"
              >
                {initialExpense ? t(language, 'modalEditTitle') : t(language, 'modalAddTitle')}
              </h2>
              {!initialExpense && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {language === 'ar'
                    ? 'أدخل التفاصيل الأساسية أولاً، ثم استخدم أداة اختيارية عند الحاجة.'
                    : language === 'fr'
                      ? 'Saisissez d’abord les détails essentiels, puis utilisez un outil facultatif si nécessaire.'
                      : 'Enter the essentials first, then use an optional tool only when needed.'}
                </p>
              )}
            </div>
            <button
              onClick={() => void discardAndClose()}
              disabled={isSaving || isPhotoPreparing}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label={t(language, 'cancelBtn')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div inert={isSaving} className="min-h-0 p-4 sm:p-5 space-y-4 overflow-y-auto flex-1" data-expense-scroll-body>
            {protectDraft && <p data-testid="draft-status" role="status" className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'ar' ? (visibleDraftStatus === 'protected' ? 'تمت حماية المصروف غير المكتمل' : visibleDraftStatus === 'error' ? 'تعذرت حماية العمل. أبقِ التطبيق مفتوحاً وحاول مجدداً.' : 'جارٍ حماية العمل…')
                : language === 'fr' ? (visibleDraftStatus === 'protected' ? 'Dépense inachevée protégée' : visibleDraftStatus === 'error' ? 'Protection impossible. Gardez l’application ouverte et réessayez.' : 'Protection en cours…')
                : (visibleDraftStatus === 'protected' ? 'Unfinished expense protected' : visibleDraftStatus === 'error' ? 'Could not protect unfinished work. Keep the app open and retry.' : 'Protecting unfinished work…')}
            </p>}
            {suggestionApplied && <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {language === 'ar' ? 'تم تطبيق الاقتراح. راجع التفاصيل واحفظ المصروف عندما تكون جاهزاً.' : language === 'fr'
                ? 'Suggestion appliquée. Vérifiez les détails, puis enregistrez la dépense.'
                : 'Suggestion applied. Review the details, then save the expense when ready.'}
            </p>}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t(language, 'amountLabel')}
              </label>
              <div className="relative rounded-2xl">
                <div
                  className={`absolute inset-y-0 flex items-center pointer-events-none font-bold text-slate-400 text-base ${
                    currency.symbolPrefix === false ? 'right-0 pr-4' : 'left-0 pl-4'
                  }`}
                >
                  {currency.symbol}
                </div>
                <input
                  type="number"
                  aria-label={t(language, 'amountLabel')}
                  step={currency.code === 'LBP' || currency.code === 'JPY' ? '1' : '0.01'}
                  placeholder={currency.code === 'LBP' || currency.code === 'JPY' ? '0' : '0.00'}
                  dir="ltr"
                  value={amountText}
                  onChange={(e) => {
                    setAmountText(e.target.value);
                    setAmountError(null);
                  }}
                  className={`w-full ${
                    currency.symbolPrefix === false ? 'pl-4 pr-14' : 'pl-14 pr-4'
                  } py-3 rounded-2xl border text-lg font-bold tabular-nums bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                    amountError
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                  }`}
                />
              </div>
              {amountError && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">
                  {amountError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t(language, 'descriptionLabel')}
              </label>
              <input
                type="text"
                ref={descriptionRef}
                aria-label={t(language, 'descriptionLabel')}
                placeholder={t(language, 'descriptionPlaceholder')}
                value={descriptionText}
                onChange={(e) => {
                  setDescriptionText(e.target.value);
                  setDescriptionError(null);
                }}
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                  descriptionError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                }`}
              />
              {descriptionError && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">
                  {descriptionError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                {t(language, 'categoryLabel')}
              </label>
              <div className="grid grid-cols-2 gap-1.5" data-expense-categories>
                {DEFAULT_CATEGORIES.map((cat) => {
                  const isSelected = cat.name.toLowerCase() === selectedCategory.toLowerCase();
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCategory(cat.name)}
                      style={{
                        borderColor: isSelected ? cat.color : undefined,
                        backgroundColor: isSelected ? `${cat.color}20` : undefined,
                      }}
                      className={`min-w-0 min-h-[48px] flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs text-start font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span aria-hidden="true">{cat.iconEmoji}</span>
                      <span>{getLocalizedCategoryName(cat.name, language)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t(language, 'dateLabel')}
              </label>
              <input
                type="date"
                aria-label={t(language, 'dateLabel')}
                value={toInputDateFormat(selectedDateMillis)}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateMillis(fromInputDateFormat(e.target.value));
                }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t(language, 'optionalNoteLabel')}
              </label>
              <textarea
                rows={3}
                aria-label={t(language, 'optionalNoteLabel')}
                placeholder={t(language, 'notePlaceholder')}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <section className="pt-1 space-y-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {optionalCopy.title}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {optionalCopy.sub}
                </p>
              </div>

              <div className="grid grid-cols-1 min-[390px]:grid-cols-3 gap-2">
                {([
                  ['smart', optionalCopy.smart, Sparkles],
                  ['receipt', optionalCopy.receipt, ReceiptText],
                  ['photos', visiblePhotoCount > 0 ? `${optionalCopy.photos} · ${visiblePhotoCount}` : optionalCopy.photos, ImagePlus],
                ] as const).map(([tool, label, Icon]) => {
                  const selected = activeTool === tool;
                  return (
                    <button
                      key={tool}
                      type="button"
                      disabled={isSaving || isPhotoPreparing}
                      onClick={() => toggleTool(tool)}
                      aria-label={label}
                      aria-expanded={selected}
                      aria-pressed={selected}
                      data-testid={`tool-${tool}-button`}
                      className={`min-h-[48px] px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="min-w-0 text-center leading-tight">{label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${selected ? 'rotate-180' : ''}`} />
                    </button>
                  );
                })}
              </div>

              <RetainedScreen active={activeTool === 'smart'}>
                <SmartCaptureCard
                  language={language}
                  currencyCode={currencyCode}
                  disabled={isSaving}
                  onPreparingChange={setSmartCapturePreparing}
                  recoveryState={recoveryDraft?.smart}
                  protectAcquisition={protectAcquisition('smart')}
                  onDraftStateChange={setSmartDraft}
                  onApply={handleSmartCaptureApply}
                />
              </RetainedScreen>

              <RetainedScreen active={activeTool === 'receipt'}>
                <ReceiptScanCard
                  language={language}
                  currencyCode={currencyCode}
                  disabled={isSaving}
                  onPreparingChange={setReceiptPreparing}
                  recoveryState={recoveryDraft?.receipt}
                  protectAcquisition={protectAcquisition('receipt')}
                  onDraftStateChange={setReceiptDraft}
                  onApply={handleReceiptScanApply}
                />
              </RetainedScreen>

              <RetainedScreen active={activeTool === 'photos'}>
                <ExpenseAttachmentsEditor
                  protectAcquisition={protectAcquisition('photos')}
                  expenseId={initialExpense?.id}
                  language={language}
                  drafts={attachmentDrafts}
                  removedAttachmentIds={removedAttachmentIds}
                  onDraftsChange={setAttachmentDrafts}
                  onRemovedAttachmentIdsChange={setRemovedAttachmentIds}
                  onPreparingChange={setAttachmentsPreparing}
                  disabled={isSaving}
                />
              </RetainedScreen>
            </section>
          </div>

          {saveError && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
              {saveError}
            </div>
          )}

          <div className="shrink-0 p-3 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void discardAndClose()}
              disabled={isSaving || isPhotoPreparing}
              className="min-h-[48px] px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t(language, 'cancelBtn')}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || isPhotoPreparing}
              className="min-h-[48px] px-6 py-2.5 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initialExpense ? t(language, 'updateExpenseBtn') : t(language, 'saveExpenseBtn')}
            </button>
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
};
