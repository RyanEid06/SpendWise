import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ImagePlus, ReceiptText, Sparkles, X } from 'lucide-react';
import { Expense, Language, ReceiptScanResult, SmartCaptureResult } from '../types';
import { DEFAULT_CATEGORIES } from '../utils/categories';
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

interface AddEditExpenseModalProps {
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
}) => {
  if (!isOpen) return null;

  const currency = getCurrency(currencyCode);
  const optionalCopy = OPTIONAL_COPY[language];
  const [amountText, setAmountText] = useState(
    initialExpense ? initialExpense.amount.toString() : ''
  );
  const [descriptionText, setDescriptionText] = useState(initialExpense?.description || '');
  const [selectedCategory, setSelectedCategory] = useState(
    initialExpense?.category || DEFAULT_CATEGORIES[0].name
  );
  const [selectedDateMillis, setSelectedDateMillis] = useState<number>(
    initialExpense?.date || defaultDate
  );
  const [noteText, setNoteText] = useState(initialExpense?.note || '');
  const [activeTool, setActiveTool] = useState<OptionalTool>(null);

  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [smartCapturePreparing, setSmartCapturePreparing] = useState(false);
  const [receiptPreparing, setReceiptPreparing] = useState(false);
  const [attachmentsPreparing, setAttachmentsPreparing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isPhotoPreparing = smartCapturePreparing || receiptPreparing || attachmentsPreparing;

  const persistedAttachmentCount = useMemo(() => {
    if (!initialExpense) return 0;
    return AttachmentStorage.getAttachmentsForExpense(initialExpense.id).filter(
      (item) => !removedAttachmentIds.includes(item.id)
    ).length;
  }, [initialExpense, removedAttachmentIds]);

  const visiblePhotoCount = persistedAttachmentCount + attachmentDrafts.length;

  useEffect(() => {
    const closeIfSafe = () => {
      if (isSaving || isPhotoPreparing) return;
      onClose();
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
  }, [isSaving, isPhotoPreparing, onClose]);

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
      setAttachmentDrafts((current) => current.concat(attachment));
    }
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

    if (hasError || isNaN(amount) || isSaving || isPhotoPreparing) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(
        amount,
        descriptionText.trim(),
        selectedCategory,
        selectedDateMillis,
        noteText.trim() || null,
        {
          newAttachments: attachmentDrafts,
          removedAttachmentIds,
        }
      );
    } catch {
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-native-back-layer="true"
      >
        <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col transition-colors">
          <div className="flex items-start justify-between gap-2 px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="min-w-0">
              <h2
                id="modal-title"
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
              onClick={onClose}
              disabled={isSaving || isPhotoPreparing}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label={t(language, 'cancelBtn')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
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
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((cat) => {
                  const isSelected = cat.name.toLowerCase() === selectedCategory.toLowerCase();
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      style={{
                        borderColor: isSelected ? cat.color : undefined,
                        backgroundColor: isSelected ? `${cat.color}20` : undefined,
                      }}
                      className={`min-h-[48px] flex items-center space-x-1.5 rtl:space-x-reverse px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
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

              {activeTool === 'smart' && (
                <SmartCaptureCard
                  language={language}
                  currencyCode={currencyCode}
                  disabled={isSaving}
                  onPreparingChange={setSmartCapturePreparing}
                  onApply={handleSmartCaptureApply}
                />
              )}

              {activeTool === 'receipt' && (
                <ReceiptScanCard
                  language={language}
                  currencyCode={currencyCode}
                  disabled={isSaving}
                  onPreparingChange={setReceiptPreparing}
                  onApply={handleReceiptScanApply}
                />
              )}

              {activeTool === 'photos' && (
                <ExpenseAttachmentsEditor
                  expenseId={initialExpense?.id}
                  language={language}
                  drafts={attachmentDrafts}
                  removedAttachmentIds={removedAttachmentIds}
                  onDraftsChange={setAttachmentDrafts}
                  onRemovedAttachmentIdsChange={setRemovedAttachmentIds}
                  onPreparingChange={setAttachmentsPreparing}
                  disabled={isSaving}
                />
              )}
            </section>
          </div>

          {saveError && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
              {saveError}
            </div>
          )}

          <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse min-[360px]:flex-row items-stretch min-[360px]:items-center justify-end gap-2 min-[360px]:gap-3">
            <button
              type="button"
              onClick={onClose}
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
