import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { Language, ReceiptScanResult } from '../types';
import { apiFetchJson } from '../utils/api';
import { getAiErrorMessage, SpendWiseApiError } from '../utils/apiErrors';
import { AttachmentDraft, AttachmentStorage } from '../utils/attachmentStorage';
import { photoAcquisitionErrorText, ta } from '../utils/attachmentTranslations';
import { DEFAULT_CATEGORIES } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName, t } from '../utils/translations';
import {
  choosePhotos,
  takePhoto,
  waitForPhotoUiPaint,
  type PhotoAcquisitionSource,
} from '../utils/imageAcquisition';

interface ReceiptScanCardProps {
  language: Language;
  currencyCode: string;
  disabled?: boolean;
  onPreparingChange?: (preparing: boolean) => void;
  onApply: (result: ReceiptScanResult) => void;
}

function optionalString(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const text = value.slice(0, max).trim();
  return text || null;
}

function parseReceiptScanResult(
  value: unknown,
  currentCurrencyCode: string
): ReceiptScanResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;

  const category =
    typeof item.category === 'string' &&
    DEFAULT_CATEGORIES.some((candidate) => candidate.name === item.category)
      ? item.category
      : null;
  if (!category) return null;

  if (typeof item.currencyMismatch !== 'boolean' || typeof item.isUncertain !== 'boolean') {
    return null;
  }

  const detectedCurrencyCode =
    item.detectedCurrencyCode == null
      ? null
      : typeof item.detectedCurrencyCode === 'string' &&
          /^[A-Z]{3}$/.test(item.detectedCurrencyCode)
        ? item.detectedCurrencyCode
        : null;
  if (item.detectedCurrencyCode != null && detectedCurrencyCode == null) return null;

  const currencyMismatch =
    detectedCurrencyCode != null && detectedCurrencyCode !== currentCurrencyCode
      ? true
      : item.currencyMismatch;
  if (item.currencyMismatch !== currencyMismatch && detectedCurrencyCode != null) return null;

  const candidateTotal =
    item.totalAmount == null
      ? null
      : typeof item.totalAmount === 'number' &&
          Number.isFinite(item.totalAmount) &&
          item.totalAmount > 0 &&
          item.totalAmount <= 1_000_000_000_000
        ? item.totalAmount
        : null;
  if (item.totalAmount != null && candidateTotal == null) return null;

  const totalAmount =
    candidateTotal != null &&
    detectedCurrencyCode === currentCurrencyCode &&
    !currencyMismatch
      ? candidateTotal
      : null;

  const dateMillis =
    item.dateMillis == null
      ? null
      : typeof item.dateMillis === 'number' &&
          Number.isFinite(item.dateMillis) &&
          item.dateMillis > 0
        ? item.dateMillis
        : null;
  if (item.dateMillis != null && dateMillis == null) return null;

  const dateFormatted =
    item.dateFormatted == null
      ? null
      : typeof item.dateFormatted === 'string' &&
          /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(item.dateFormatted)
        ? item.dateFormatted
        : null;
  if (item.dateFormatted != null && dateFormatted == null) return null;

  const items = Array.isArray(item.items)
    ? item.items
        .slice(0, 50)
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.slice(0, 200).trim())
        .filter(Boolean)
    : [];

  return {
    merchant: optionalString(item.merchant, 160),
    totalAmount,
    dateMillis,
    dateFormatted,
    category,
    items,
    notesSummary: optionalString(item.notesSummary, 4000),
    detectedCurrencyCode,
    currencyMismatch,
    isUncertain: item.isUncertain || totalAmount == null,
    uncertaintyReason: optionalString(item.uncertaintyReason, 1000),
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('RECEIPT_FILE_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

export const ReceiptScanCard: React.FC<ReceiptScanCardProps> = ({
  language,
  currencyCode,
  disabled = false,
  onPreparingChange,
  onApply,
}) => {
  const preparationRequestIdRef = useRef(0);
  const requestIdRef = useRef(0);
  const acquisitionInFlightRef = useRef(false);
  const analysisInFlightRef = useRef(false);
  const preparedPreviewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedDraft, setPreparedDraft] = useState<AttachmentDraft | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onPreparingChange?.(isPreparing);
  }, [isPreparing, onPreparingChange]);

  useEffect(() => {
    return () => {
      preparationRequestIdRef.current += 1;
      requestIdRef.current += 1;
      acquisitionInFlightRef.current = false;
      analysisInFlightRef.current = false;
      if (preparedPreviewUrlRef.current) URL.revokeObjectURL(preparedPreviewUrlRef.current);
    };
  }, []);

  const clearPreparedPreview = () => {
    if (preparedPreviewUrlRef.current) {
      URL.revokeObjectURL(preparedPreviewUrlRef.current);
      preparedPreviewUrlRef.current = null;
    }
  };

  const resetSelection = () => {
    preparationRequestIdRef.current += 1;
    requestIdRef.current += 1;
    analysisInFlightRef.current = false;
    clearPreparedPreview();
    setPreviewUrl(null);
    setPreparedDraft(null);
    setIsPreparing(false);
    setIsScanning(false);
    setResult(null);
    setError(null);
  };

  const beginPhotoSelection = async (source: PhotoAcquisitionSource) => {
    if (disabled || acquisitionInFlightRef.current || isScanning) return;

    acquisitionInFlightRef.current = true;
    setIsAcquiring(true);
    setError(null);

    let acquired = null;
    try {
      acquired =
        source === 'camera' ? await takePhoto() : (await choosePhotos(1))[0] || null;
    } catch (acquisitionError) {
      setError(photoAcquisitionErrorText(language, acquisitionError));
      return;
    } finally {
      acquisitionInFlightRef.current = false;
      setIsAcquiring(false);
    }

    if (!acquired) return;

    requestIdRef.current += 1;
    analysisInFlightRef.current = false;
    const preparationRequestId = ++preparationRequestIdRef.current;
    clearPreparedPreview();
    setPreviewUrl(acquired.previewUrl);
    setPreparedDraft(null);
    setResult(null);
    setError(null);
    setIsScanning(false);
    setIsPreparing(true);

    await waitForPhotoUiPaint();

    try {
      const file = await acquired.loadFile();
      const draft = await AttachmentStorage.prepareImageDraft(file, 'receipt');
      if (preparationRequestId !== preparationRequestIdRef.current) return;

      const preparedPreviewUrl = URL.createObjectURL(draft.blob);
      clearPreparedPreview();
      preparedPreviewUrlRef.current = preparedPreviewUrl;
      setPreparedDraft(draft);
      setPreviewUrl(preparedPreviewUrl);
    } catch {
      if (preparationRequestId !== preparationRequestIdRef.current) return;
      setPreparedDraft(null);
      setError(ta(language, 'photoPrepareError'));
    } finally {
      if (preparationRequestId === preparationRequestIdRef.current) {
        setIsPreparing(false);
      }
    }
  };

  const analyze = async () => {
    if (!preparedDraft || disabled || isPreparing || isScanning || analysisInFlightRef.current) {
      return;
    }

    analysisInFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setIsScanning(true);
    setResult(null);
    setError(null);

    try {
      const imageBase64 = await blobToDataUrl(preparedDraft.blob);
      if (requestId !== requestIdRef.current) return;

      const responseData = await apiFetchJson<unknown>(
        '/api/gemini/scan-receipt',
        {
          method: 'POST',
          body: JSON.stringify({
            imageBase64,
            mimeType: preparedDraft.mimeType,
            language,
            currencyCode,
          }),
        },
        45000
      );

      const parsed = parseReceiptScanResult(responseData, currencyCode);
      if (!parsed) throw new SpendWiseApiError('invalid_response');
      if (requestId !== requestIdRef.current) return;
      setResult(parsed);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setError(getAiErrorMessage(language, error));
    } finally {
      if (requestId === requestIdRef.current) {
        analysisInFlightRef.current = false;
        setIsScanning(false);
      }
    }
  };

  return (
    <section className="rounded-2xl border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/40 p-4 space-y-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-purple-200/80 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
          <Camera className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm text-purple-950 dark:text-purple-100">
            {t(language, 'scanReceiptCardTitle')}
          </h4>
          <p className="text-xs leading-relaxed text-purple-700/80 dark:text-purple-300/80">
            {t(language, 'scanReceiptCardSub')}
          </p>
        </div>
        {previewUrl && (
          <button
            type="button"
            disabled={disabled}
            onClick={resetSelection}
            className="min-w-[36px] min-h-[36px] rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center justify-center disabled:opacity-50"
            aria-label={t(language, 'receiptRemovePhoto')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || isAcquiring || isScanning}
          onClick={() => void beginPhotoSelection('camera')}
          className="min-h-[44px] rounded-xl border border-purple-300 dark:border-purple-800 bg-white/80 dark:bg-[#111928]/80 text-purple-800 dark:text-purple-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          <span>{ta(language, 'takePhoto')}</span>
        </button>
        <button
          type="button"
          disabled={disabled || isAcquiring || isScanning}
          onClick={() => void beginPhotoSelection('gallery')}
          className="min-h-[44px] rounded-xl border border-purple-300 dark:border-purple-800 bg-white/80 dark:bg-[#111928]/80 text-purple-800 dark:text-purple-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isAcquiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          <span>{ta(language, 'choosePhoto')}</span>
        </button>
      </div>

      {previewUrl && (
        <>
          <div className="relative rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800 bg-black/5 dark:bg-black/30">
            <img
              src={previewUrl}
              alt={t(language, 'receiptPreviewAlt')}
              className="w-full max-h-48 object-contain"
            />
            {isPreparing && (
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 text-white px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{ta(language, 'processingPhoto')}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={disabled || isPreparing || !preparedDraft || isScanning}
            onClick={() => void analyze()}
            className="w-full min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
          >
            {isScanning && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isScanning ? t(language, 'scanningStatus') : t(language, 'receiptAnalyzePhoto')}</span>
          </button>
        </>
      )}

      {isScanning && (
        <div className="flex items-center gap-2 text-xs text-purple-800 dark:text-purple-300 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
          <span>{t(language, 'analyzingReceiptMsg')}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {result && !isScanning && (
        <div className="p-3.5 rounded-xl bg-purple-100/70 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-purple-950 dark:text-purple-200 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{t(language, 'receiptScanSuccess')}</span>
            </div>
            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
              {t(language, 'reviewValuesPrompt')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'merchantLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white break-words">
                {result.merchant || t(language, 'uncertainLabel')}
              </p>
            </div>
            <div className="min-w-0 text-right rtl:text-left">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'totalLabel')}</span>
              <p className="font-bold tabular-nums text-slate-900 dark:text-white">
                {result.totalAmount != null
                  ? formatCurrency(result.totalAmount, currencyCode)
                  : t(language, 'uncertainLabel')}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'dateLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {result.dateFormatted || t(language, 'uncertainLabel')}
              </p>
            </div>
            <div className="min-w-0 text-right rtl:text-left">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'categoryLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {getLocalizedCategoryName(result.category || 'Other', language)}
              </p>
            </div>
          </div>

          {(result.currencyMismatch || result.totalAmount == null || result.uncertaintyReason) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
              {result.currencyMismatch
                ? t(language, 'receiptCurrencyMismatch')
                : result.uncertaintyReason || t(language, 'receiptAmountManual')}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(language, 'receiptNotSavedYet')}
          </p>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onApply(result)}
            className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t(language, 'receiptApplyDraft')}
          </button>
        </div>
      )}
    </section>
  );
};
