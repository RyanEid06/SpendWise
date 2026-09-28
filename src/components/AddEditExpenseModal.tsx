import React, { useState, useRef } from 'react';
import { apiFetch } from '../utils/api';
import { Camera, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Expense, Language, ReceiptScanResult, SmartCaptureResult } from '../types';
import { DEFAULT_CATEGORIES } from '../utils/categories';
import { getCurrency, formatCurrency } from '../utils/currency';
import { fromInputDateFormat, toInputDateFormat } from '../utils/date';
import { getLocalizedCategoryName, t } from '../utils/translations';
import { ExpenseAttachmentsEditor } from './ExpenseAttachmentsEditor';
import { AttachmentDraft, AttachmentEditPayload, AttachmentStorage, MAX_ATTACHMENTS_PER_EXPENSE } from '../utils/attachmentStorage';
import { ta } from '../utils/attachmentTranslations';
import { SmartCaptureCard } from './SmartCaptureCard';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Receipt scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ReceiptScanResult | null>(null);

  // WP07 attachment edits are staged in memory until Save. This prevents
  // cancelled new-expense flows from leaving permanent orphan files.
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      setScanError(t(language, 'receiptScanError'));
      e.target.value = '';
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await apiFetch(
            '/api/gemini/scan-receipt',
            {
              method: 'POST',
              body: JSON.stringify({
                imageBase64: base64Data,
                mimeType: file.type || 'image/jpeg',
                language,
              }),
            },
            45000
          );

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || t(language, 'receiptScanError'));
          }

          const extracted: ReceiptScanResult = await res.json();
          setScannedResult(extracted);

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
          if (extracted.dateMillis) {
            setSelectedDateMillis(extracted.dateMillis);
          }
          if (extracted.notesSummary) {
            setNoteText((prev) => (prev ? `${prev}\n${extracted.notesSummary}` : extracted.notesSummary!));
          }
        } catch {
          setScanError(t(language, 'receiptScanError'));
        } finally {
          setIsScanning(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        setScanError(t(language, 'receiptScanError'));
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch {
      setScanError(t(language, 'receiptScanError'));
      setIsScanning(false);
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
      result.description && result.merchantOrBrand &&
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

    if (attachment) {
      const persistedCount = initialExpense
        ? AttachmentStorage.getAttachmentsForExpense(initialExpense.id).filter(
            (item) => !removedAttachmentIds.includes(item.id)
          ).length
        : 0;
      if (persistedCount + attachmentDrafts.length < MAX_ATTACHMENTS_PER_EXPENSE) {
        setAttachmentDrafts((current) => current.concat(attachment));
      }
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

    if (hasError || isNaN(amount) || isSaving) return;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {initialExpense ? t(language, 'modalEditTitle') : t(language, 'modalAddTitle')}
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <SmartCaptureCard
            language={language}
            currencyCode={currencyCode}
            disabled={isSaving || isScanning}
            onApply={handleSmartCaptureApply}
          />

          {/* Scan Receipt Action Card */}
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-200/80 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-purple-950 dark:text-purple-100 truncate">
                    {t(language, 'scanReceiptCardTitle')}
                  </h4>
                  <p className="text-xs text-purple-700/80 dark:text-purple-300/80 truncate">
                    {t(language, 'scanReceiptCardSub')}
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center space-x-1.5 rtl:space-x-reverse active:scale-95 shrink-0"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t(language, 'scanningStatus')}</span>
                  </>
                ) : (
                  <span>{t(language, 'uploadPhotoBtn')}</span>
                )}
              </button>
            </div>

            {/* Scanning Indicator */}
            {isScanning && (
              <div className="mt-3 flex items-center space-x-2 rtl:space-x-reverse text-xs text-purple-800 dark:text-purple-300 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
                <span>{t(language, 'analyzingReceiptMsg')}</span>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 text-xs flex items-center space-x-2.5 rtl:space-x-reverse border border-rose-200 dark:border-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Extracted Receipt Review Card */}
            {scannedResult && !isScanning && (
              <div className="mt-3.5 p-3.5 rounded-xl bg-purple-100/70 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-purple-950 dark:text-purple-200 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t(language, 'receiptScanSuccess')}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                    {t(language, 'reviewValuesPrompt')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t(language, 'merchantLabel')}</span>
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {scannedResult.merchant || t(language, 'uncertainLabel')}
                    </p>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span className="text-slate-500 dark:text-slate-400">{t(language, 'totalLabel')}</span>
                    <p className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {scannedResult.totalAmount != null
                        ? formatCurrency(scannedResult.totalAmount, currencyCode)
                        : t(language, 'uncertainLabel')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ExpenseAttachmentsEditor
            expenseId={initialExpense?.id}
            language={language}
            drafts={attachmentDrafts}
            removedAttachmentIds={removedAttachmentIds}
            onDraftsChange={setAttachmentDrafts}
            onRemovedAttachmentIdsChange={setRemovedAttachmentIds}
            disabled={isSaving}
          />

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t(language, 'amountLabel')}
            </label>
            <div className="relative rounded-2xl">
              <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-4 rtl:pl-0 rtl:pr-4 flex items-center pointer-events-none font-bold text-slate-400 text-lg">
                {currency.symbol}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  setAmountError(null);
                }}
                className={`w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 rounded-2xl border text-lg font-bold tabular-nums bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                  amountError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                }`}
              />
            </div>
            {amountError && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">{amountError}</p>}
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t(language, 'descriptionLabel')}
            </label>
            <input
              type="text"
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
              <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">{descriptionError}</p>
            )}
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              {t(language, 'categoryLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = cat.name.toLowerCase() === selectedCategory.toLowerCase();
                const localizedCatName = getLocalizedCategoryName(cat.name, language);
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      borderColor: isSelected ? cat.color : undefined,
                      backgroundColor: isSelected ? `${cat.color}20` : undefined,
                    }}
                    className={`min-h-[44px] flex items-center space-x-1.5 rtl:space-x-reverse px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span aria-hidden="true">{cat.iconEmoji}</span>
                    <span>{localizedCatName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t(language, 'dateLabel')}
            </label>
            <div className="relative">
              <input
                type="date"
                value={toInputDateFormat(selectedDateMillis)}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDateMillis(fromInputDateFormat(e.target.value));
                  }
                }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t(language, 'optionalNoteLabel')}
            </label>
            <textarea
              rows={3}
              placeholder={t(language, 'notePlaceholder')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {saveError && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-300">
            {saveError}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t(language, 'cancelBtn')}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="min-h-[44px] px-6 py-2.5 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialExpense ? t(language, 'updateExpenseBtn') : t(language, 'saveExpenseBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
