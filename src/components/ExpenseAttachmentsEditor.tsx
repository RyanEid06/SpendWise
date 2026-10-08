import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  Trash2,
  X,
} from 'lucide-react';
import { ExpenseAttachmentKind, Language } from '../types';
import {
  AttachmentDraft,
  AttachmentStorage,
  MAX_ATTACHMENTS_PER_EXPENSE,
} from '../utils/attachmentStorage';
import { photoAcquisitionErrorText, ta } from '../utils/attachmentTranslations';
import {
  choosePhotos,
  takePhoto,
  waitForPhotoUiPaint,
  type AcquiredPhoto,
} from '../utils/imageAcquisition';
import { ViewportPortal } from './ViewportPortal';
import { useModalFocus } from './useModalFocus';

interface ExpenseAttachmentsEditorProps {
  protectAcquisition?: (operation: () => Promise<AttachmentDraft[]>, accept?: () => boolean) => Promise<AttachmentDraft[]>;
  expenseId?: number;
  language: Language;
  drafts: AttachmentDraft[];
  removedAttachmentIds: string[];
  onDraftsChange: (drafts: AttachmentDraft[]) => void;
  onRemovedAttachmentIdsChange: (ids: string[]) => void;
  onPreparingChange?: (preparing: boolean) => void;
  disabled?: boolean;
}

type PreviewState = {
  url: string;
  label: string;
};

type PendingPhoto = {
  id: string;
  photo: AcquiredPhoto;
  kind: ExpenseAttachmentKind;
};

function kindLabel(language: Language, kind: ExpenseAttachmentKind): string {
  if (kind === 'purchase') return ta(language, 'kindPurchase');
  if (kind === 'receipt') return ta(language, 'kindReceipt');
  return ta(language, 'kindProof');
}

function errorMessage(language: Language, error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ATTACHMENT_TOO_LARGE') return ta(language, 'photoTooLarge');
  if (code === 'ATTACHMENT_UNSUPPORTED') return ta(language, 'photoUnsupported');
  if (code === 'ATTACHMENT_LIMIT') {
    return ta(language, 'photoLimit', { count: MAX_ATTACHMENTS_PER_EXPENSE });
  }
  return ta(language, 'photoPrepareError');
}

function createPendingId(index: number): string {
  return `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ExpenseAttachmentsEditor: React.FC<ExpenseAttachmentsEditorProps> = ({
  expenseId,
  language,
  drafts,
  removedAttachmentIds,
  onDraftsChange,
  onRemovedAttachmentIdsChange,
  onPreparingChange,
  disabled = false,
  protectAcquisition,
}) => {
  const preparationGenerationRef = useRef(0);
  const acquisitionInFlightRef = useRef(false);
  const cancelledPendingIdsRef = useRef<Set<string>>(new Set());
  const draftsRef = useRef(drafts);
  const [selectedKind, setSelectedKind] = useState<ExpenseAttachmentKind>('receipt');
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [persistedUrls, setPersistedUrls] = useState<Record<string, string>>({});
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [draftUrls, setDraftUrls] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewRef = useModalFocus(undefined, Boolean(preview));

  draftsRef.current = drafts;

  const persisted = useMemo(
    () => (expenseId ? AttachmentStorage.getAttachmentsForExpense(expenseId) : []),
    [expenseId]
  );
  const visiblePersisted = persisted.filter((item) => !removedAttachmentIds.includes(item.id));
  const totalVisible = visiblePersisted.length + drafts.length + pendingPhotos.length;

  useEffect(() => {
    onPreparingChange?.(isPreparing || isAcquiring);
  }, [isPreparing, isAcquiring, onPreparingChange]);

  useEffect(() => {
    return () => {
      preparationGenerationRef.current += 1;
      acquisitionInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    setPersistedUrls({});
    setMissingIds(new Set());

    void Promise.all(
      visiblePersisted.map(async (item) => {
        try {
          const url = await AttachmentStorage.readAttachmentUrl(item);
          if (cancelled) {
            AttachmentStorage.revokePreviewUrl(url);
            return;
          }
          createdUrls.push(url);
          setPersistedUrls((current) => ({ ...current, [item.id]: url }));
        } catch {
          if (!cancelled) {
            setMissingIds((current) => {
              const next = new Set(current);
              next.add(item.id);
              return next;
            });
          }
        }
      })
    );

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => AttachmentStorage.revokePreviewUrl(url));
    };
  }, [expenseId, removedAttachmentIds.join('|')]);

  useEffect(() => {
    const urls = drafts.map((draft) => URL.createObjectURL(draft.blob));
    setDraftUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [drafts]);

  useEffect(() => {
    if (!preview) return;

    const close = () => setPreview(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('spendwise-close-attachment-preview', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('spendwise-close-attachment-preview', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [preview]);

  const preparePhotos = async (photos: AcquiredPhoto[]): Promise<AttachmentDraft[]> => {
    if (photos.length === 0) return [];

    const generation = ++preparationGenerationRef.current;
    const kind = selectedKind;
    cancelledPendingIdsRef.current.clear();
    const pending = photos.map((photo, index) => ({
      id: createPendingId(index),
      photo,
      kind,
    }));
    setPendingPhotos(pending);
    setIsPreparing(true);
    setError(null);

    await waitForPhotoUiPaint();

    const prepared: AttachmentDraft[] = [];
    try {
      for (const item of pending) {
        const file = await item.photo.loadFile();
        const draft = await AttachmentStorage.prepareImageDraft(file, item.kind);
        if (!cancelledPendingIdsRef.current.has(item.id)) {
          prepared.push(draft);
        }
      }

      return prepared;
    } catch (err) {
      if (generation === preparationGenerationRef.current) {
        setError(errorMessage(language, err));
      }
      throw err;
    } finally {
      if (generation === preparationGenerationRef.current) {
        setPendingPhotos([]);
        cancelledPendingIdsRef.current.clear();
        setIsPreparing(false);
      }
    }
  };

  const acquireAndPrepare = async (operation: () => Promise<AcquiredPhoto[]>) => {
    const generation = preparationGenerationRef.current;
    const prepare = async () => preparePhotos(await operation());
    const prepared = await (protectAcquisition ? protectAcquisition(prepare) : prepare());
    // Authentication may have destroyed this editor; the service already owns
    // its result. Only the current mounted editor gets preview/state updates.
    if (preparationGenerationRef.current !== generation + (prepared.length > 0 ? 1 : 0)) return;
    if (prepared.length > 0) {
      const next = draftsRef.current.concat(prepared);
      draftsRef.current = next;
      onDraftsChange(next);
    }
  };

  const beginCameraAcquisition = async () => {
    if (disabled || isPreparing || acquisitionInFlightRef.current) return;

    const available =
      MAX_ATTACHMENTS_PER_EXPENSE - visiblePersisted.length - draftsRef.current.length;
    if (available <= 0) {
      setError(ta(language, 'photoLimit', { count: MAX_ATTACHMENTS_PER_EXPENSE }));
      return;
    }

    acquisitionInFlightRef.current = true;
    setIsAcquiring(true);
    setError(null);
    try {
      await acquireAndPrepare(async () => { const photo = await takePhoto(); return photo ? [photo] : []; });
    } catch (acquisitionError) {
      setError(photoAcquisitionErrorText(language, acquisitionError));
    } finally {
      acquisitionInFlightRef.current = false;
      setIsAcquiring(false);
    }
  };

  const beginGalleryAcquisition = async () => {
    if (disabled || isPreparing || acquisitionInFlightRef.current) return;

    const available =
      MAX_ATTACHMENTS_PER_EXPENSE - visiblePersisted.length - draftsRef.current.length;
    if (available <= 0) {
      setError(ta(language, 'photoLimit', { count: MAX_ATTACHMENTS_PER_EXPENSE }));
      return;
    }

    acquisitionInFlightRef.current = true;
    setIsAcquiring(true);
    setError(null);
    try {
      await acquireAndPrepare(async () => (await choosePhotos(available)).slice(0, available));
    } catch (acquisitionError) {
      setError(photoAcquisitionErrorText(language, acquisitionError));
    } finally {
      acquisitionInFlightRef.current = false;
      setIsAcquiring(false);
    }
  };

  const markPersistedRemoved = (id: string) => {
    setPreview(null);
    onRemovedAttachmentIdsChange(removedAttachmentIds.concat(id));
  };

  const removeDraft = (index: number) => {
    setPreview(null);
    const next = draftsRef.current.filter((_, draftIndex) => draftIndex !== index);
    draftsRef.current = next;
    onDraftsChange(next);
  };

  const removePendingPhoto = (id: string) => {
    cancelledPendingIdsRef.current.add(id);
    setPendingPhotos((current) => current.filter((item) => item.id !== id));
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F19]/70 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {ta(language, 'attachmentsTitle')}
            </h4>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">
            {ta(language, 'attachmentsSub')}
          </p>
        </div>
        {totalVisible > 0 && (
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
            {totalVisible}/{MAX_ATTACHMENTS_PER_EXPENSE}
          </span>
        )}
      </div>

      {totalVisible > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {visiblePersisted.map((item) => {
            const url = persistedUrls[item.id];
            const missing = missingIds.has(item.id);
            return (
              <div
                key={item.id}
                className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {url ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ url, label: kindLabel(language, item.kind) })}
                    className="w-full h-full cursor-pointer"
                    aria-label={ta(language, 'viewPhotos')}
                  >
                    <img src={url} alt={kindLabel(language, item.kind)} className="w-full h-full object-cover" />
                    <span className="absolute left-1.5 bottom-1.5 rtl:left-auto rtl:right-1.5 rounded-md bg-black/65 text-white p-1">
                      <Maximize2 className="w-3 h-3" />
                    </span>
                  </button>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-400">
                    <ImageIcon className="w-5 h-5" />
                    {missing && (
                      <span className="text-[9px] leading-tight">{ta(language, 'photoMissing')}</span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => markPersistedRemoved(item.id)}
                  className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 w-8 h-8 rounded-lg bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
                  aria-label={ta(language, 'removePhoto')}
                  title={ta(language, 'removePhoto')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {pendingPhotos.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square rounded-xl overflow-hidden border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900"
            >
              <img
                src={item.photo.previewUrl}
                alt={kindLabel(language, item.kind)}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 text-white px-1.5 py-1.5 text-[9px] font-semibold flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{ta(language, 'processingPhoto')}</span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removePendingPhoto(item.id)}
                className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 w-8 h-8 rounded-lg bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
                aria-label={ta(language, 'removePhoto')}
                title={ta(language, 'removePhoto')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {drafts.map((draft, index) => {
            const url = draftUrls[index];
            return (
              <div
                key={'draft-' + index}
                className="relative aspect-square rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900"
              >
                {url && (
                  <button
                    type="button"
                    onClick={() => setPreview({ url, label: kindLabel(language, draft.kind) })}
                    className="w-full h-full cursor-pointer"
                    aria-label={ta(language, 'viewPhotos')}
                  >
                    <img src={url} alt={kindLabel(language, draft.kind)} className="w-full h-full object-cover" />
                    <span className="absolute left-1.5 bottom-1.5 rtl:left-auto rtl:right-1.5 rounded-md bg-black/65 text-white p-1">
                      <Maximize2 className="w-3 h-3" />
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeDraft(index)}
                  className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 w-8 h-8 rounded-lg bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
                  aria-label={ta(language, 'removePhoto')}
                  title={ta(language, 'removePhoto')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <select
        value={selectedKind}
        disabled={disabled || isPreparing || isAcquiring}
        onChange={(event) => setSelectedKind(event.target.value as ExpenseAttachmentKind)}
        aria-label={ta(language, 'attachmentKind')}
        className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111928] text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="purchase">{ta(language, 'kindPurchase')}</option>
        <option value="receipt">{ta(language, 'kindReceipt')}</option>
      </select>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || isPreparing || isAcquiring || totalVisible >= MAX_ATTACHMENTS_PER_EXPENSE}
          onClick={() => void beginCameraAcquisition()}
          className="min-h-[48px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="w-4 h-4" />
          <span>{ta(language, 'takePhoto')}</span>
        </button>
        <button
          type="button"
          disabled={disabled || isPreparing || isAcquiring || totalVisible >= MAX_ATTACHMENTS_PER_EXPENSE}
          onClick={() => void beginGalleryAcquisition()}
          className="min-h-[48px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAcquiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          <span>{ta(language, 'choosePhoto')}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <ViewportPortal>
        <div
          data-attachment-viewer="true"
          ref={previewRef}
          tabIndex={-1}
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.label}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 min-w-[48px] min-h-[48px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            aria-label={ta(language, 'closePreview')}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={preview.url}
            alt={preview.label}
            className="max-w-full max-h-[88vh] object-contain rounded-xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        </ViewportPortal>
      )}
    </section>
  );
};
