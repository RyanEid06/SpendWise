import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { Language, SmartCaptureResult } from '../types';
import { apiFetchJson } from '../utils/api';
import { getAiErrorMessage, SpendWiseApiError } from '../utils/apiErrors';
import { AttachmentDraft, AttachmentStorage } from '../utils/attachmentStorage';
import { photoAcquisitionErrorText, ta } from '../utils/attachmentTranslations';
import { getLocalizedCategoryName, t } from '../utils/translations';
import { formatCurrency } from '../utils/currency';
import { DEFAULT_CATEGORIES } from '../utils/categories';
import {
  choosePhotos,
  takePhoto,
  waitForPhotoUiPaint,
  type PhotoAcquisitionSource,
} from '../utils/imageAcquisition';

interface SmartCaptureCardProps {
  language: Language;
  currencyCode: string;
  disabled?: boolean;
  onPreparingChange?: (preparing: boolean) => void;
  onApply: (result: SmartCaptureResult, attachment: AttachmentDraft | null) => void;
}

function parseSmartCaptureResult(value: unknown, currentCurrencyCode: string): SmartCaptureResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;

  if (
    typeof item.category !== 'string' ||
    !DEFAULT_CATEGORIES.some((category) => category.name === item.category)
  ) {
    return null;
  }

  if (
    item.confidence !== 'high' &&
    item.confidence !== 'medium' &&
    item.confidence !== 'low'
  ) {
    return null;
  }

  if (typeof item.priceVisible !== 'boolean' || typeof item.currencyMismatch !== 'boolean') {
    return null;
  }

  const candidateAmount =
    item.amount == null
      ? null
      : typeof item.amount === 'number' &&
          Number.isFinite(item.amount) &&
          item.amount > 0 &&
          item.amount <= 1_000_000_000_000
        ? item.amount
        : null;

  if (item.amount != null && candidateAmount == null) return null;

  const optionalString = (candidate: unknown, max: number): string | null => {
    if (candidate == null) return null;
    if (typeof candidate !== 'string') return null;
    const trimmed = candidate.slice(0, max).trim();
    return trimmed || null;
  };

  const detectedCurrencyCode =
    item.detectedCurrencyCode == null
      ? null
      : typeof item.detectedCurrencyCode === 'string' &&
          /^[A-Z]{3}$/.test(item.detectedCurrencyCode)
        ? item.detectedCurrencyCode
        : null;

  if (item.detectedCurrencyCode != null && detectedCurrencyCode == null) return null;

  const currencyMismatch =
    detectedCurrencyCode != null && detectedCurrencyCode !== currentCurrencyCode;
  if (item.currencyMismatch !== currencyMismatch) return null;

  const amount =
    item.priceVisible &&
    detectedCurrencyCode === currentCurrencyCode &&
    !currencyMismatch &&
    candidateAmount != null
      ? candidateAmount
      : null;

  return {
    description: optionalString(item.description, 240),
    category: item.category,
    amount,
    merchantOrBrand: optionalString(item.merchantOrBrand, 200),
    notes: optionalString(item.notes, 1000),
    confidence: item.confidence,
    uncertaintyReason: optionalString(item.uncertaintyReason, 1000),
    priceVisible: item.priceVisible,
    detectedCurrencyCode,
    currencyMismatch,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('SMART_CAPTURE_FILE_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

export const SmartCaptureCard: React.FC<SmartCaptureCardProps> = ({
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
  const attachmentAppliedRef = useRef(false);
  const preparedPreviewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedDraft, setPreparedDraft] = useState<AttachmentDraft | null>(null);
  const [result, setResult] = useState<SmartCaptureResult | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    setResult(null);
    setError(null);
    setIsPreparing(false);
    setIsAnalyzing(false);
    attachmentAppliedRef.current = false;
  };

  const beginPhotoSelection = async (source: PhotoAcquisitionSource) => {
    if (disabled || acquisitionInFlightRef.current || isAnalyzing) return;

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
    setIsAnalyzing(false);
    setIsPreparing(true);
      attachmentAppliedRef.current = false;

    await waitForPhotoUiPaint();

    try {
      const file = await acquired.loadFile();
      const draft = await AttachmentStorage.prepareImageDraft(file, 'purchase');
      if (preparationRequestId !== preparationRequestIdRef.current) return;

      const preparedPreviewUrl = URL.createObjectURL(draft.blob);
      clearPreparedPreview();
      preparedPreviewUrlRef.current = preparedPreviewUrl;
      setPreparedDraft(draft);
      setPreviewUrl(preparedPreviewUrl);
    } catch {
      if (preparationRequestId !== preparationRequestIdRef.current) return;
      setPreparedDraft(null);
      setError(t(language, 'smartCaptureInvalidImage'));
    } finally {
      if (preparationRequestId === preparationRequestIdRef.current) {
        setIsPreparing(false);
      }
    }
  };

  const analyze = async () => {
    if (!preparedDraft || isPreparing || isAnalyzing || analysisInFlightRef.current || disabled) {
      return;
    }

    analysisInFlightRef.current = true;
    const requestId = ++requestIdRef.current;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const imageBase64 = await blobToDataUrl(preparedDraft.blob);
      if (requestId !== requestIdRef.current) return;

      const responseData = await apiFetchJson<unknown>(
        '/api/gemini/smart-capture',
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

      const data = parseSmartCaptureResult(responseData, currencyCode);
      if (!data) throw new SpendWiseApiError('invalid_response');
      if (requestId !== requestIdRef.current) return;
      setResult(data);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setError(getAiErrorMessage(language, error));
    } finally {
      if (requestId === requestIdRef.current) {
        analysisInFlightRef.current = false;
        setIsAnalyzing(false);
      }
    }
  };

  const applyResult = () => {
    if (!result) return;
    const attachment = attachmentAppliedRef.current ? null : preparedDraft;
    onApply(result, attachment);
    attachmentAppliedRef.current = true;
  };

  return (
    <section className="rounded-2xl border border-cyan-200 dark:border-cyan-900/70 bg-cyan-50/70 dark:bg-cyan-950/25 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-cyan-950 dark:text-cyan-100">
              {t(language, 'smartCaptureTitle')}
            </h4>
            <p className="text-xs leading-relaxed text-cyan-800/80 dark:text-cyan-300/80 mt-0.5">
              {t(language, 'smartCaptureSub')}
            </p>
          </div>
        </div>
        {previewUrl && (
          <button
            type="button"
            disabled={disabled}
            onClick={resetSelection}
            className="min-w-[36px] min-h-[36px] rounded-lg text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 flex items-center justify-center disabled:opacity-50"
            aria-label={t(language, 'smartCaptureRemovePhoto')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || isAcquiring || isAnalyzing}
          onClick={() => void beginPhotoSelection('camera')}
          className="min-h-[44px] rounded-xl border border-cyan-300 dark:border-cyan-800 bg-white/80 dark:bg-[#111928]/80 text-cyan-800 dark:text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          <span>{ta(language, 'takePhoto')}</span>
        </button>
        <button
          type="button"
          disabled={disabled || isAcquiring || isAnalyzing}
          onClick={() => void beginPhotoSelection('gallery')}
          className="min-h-[44px] rounded-xl border border-cyan-300 dark:border-cyan-800 bg-white/80 dark:bg-[#111928]/80 text-cyan-800 dark:text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isAcquiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          <span>{ta(language, 'choosePhoto')}</span>
        </button>
      </div>

      {previewUrl && (
        <>
          <div className="relative rounded-xl overflow-hidden border border-cyan-200 dark:border-cyan-800 bg-black/5 dark:bg-black/30">
            <img
              src={previewUrl}
              alt={t(language, 'smartCapturePreviewAlt')}
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
            disabled={disabled || isPreparing || !preparedDraft || isAnalyzing}
            onClick={() => void analyze()}
            className="w-full min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isAnalyzing ? t(language, 'smartCaptureAnalyzing') : t(language, 'smartCaptureAnalyze')}</span>
          </button>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && !isAnalyzing && (
        <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-white/80 dark:bg-[#111928]/80 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-950 dark:text-cyan-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t(language, 'smartCaptureDraftReady')}</span>
          </div>

          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'descriptionLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white break-words">
                {result.description || t(language, 'uncertainLabel')}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'categoryLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white break-words">{getLocalizedCategoryName(result.category, language)}</p>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'amountLabel')}</span>
              <p dir="ltr" className="min-w-0 font-semibold text-slate-900 dark:text-white [overflow-wrap:anywhere] leading-tight">
                {result.amount != null ? formatCurrency(result.amount, currencyCode) : t(language, 'smartCaptureAmountMissing')}
              </p>
            </div>
            <div className="min-w-0">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'smartCaptureConfidenceLabel')}</span>
              <p className="font-semibold text-slate-900 dark:text-white">
                {result.confidence === 'high'
                  ? t(language, 'smartCaptureConfidence_high')
                  : result.confidence === 'medium'
                    ? t(language, 'smartCaptureConfidence_medium')
                    : t(language, 'smartCaptureConfidence_low')}
              </p>
            </div>
          </div>

          {(result.uncertaintyReason || result.currencyMismatch || !result.priceVisible) && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
              {result.currencyMismatch
                ? t(language, 'smartCaptureCurrencyMismatch')
                : result.uncertaintyReason || t(language, 'smartCaptureNoVisiblePrice')}
            </div>
          )}

          <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t(language, 'smartCaptureNotSavedYet')}
          </div>

          <button
            type="button"
            onClick={applyResult}
            className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold"
          >
            {t(language, 'smartCaptureReviewExpense')}
          </button>
        </div>
      )}
    </section>
  );
};
