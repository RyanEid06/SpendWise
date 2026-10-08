import type { AttachmentDraft } from '../utils/attachmentStorage';
import { LocalDataStore, type LocalDataStoreImpl } from '../utils/localDataStore';
import { cleanupNativeAcquisitionFiles } from '../utils/imageAcquisition';
import { type DraftToolState, type ExpenseEditorDraft, type StoredExpenseDraft, type StoredDraftPhoto, validateStoredDraft } from '../data/ExpenseDraft';

type DraftStore = Pick<LocalDataStoreImpl, 'getExpenseDraft' | 'readExpenseDraftMedia' | 'writeExpenseDraft' | 'discardExpenseDraft'>;

function encode(bytes: Uint8Array): string {
  let raw = '';
  for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
}

export class ExpenseDraftRecoveryService {
  private queue: Promise<void> = Promise.resolve();
  private photos = new WeakMap<AttachmentDraft, { meta: StoredDraftPhoto; data: string }>();
  private closedIds = new Set<string>();
  private acquisitions = new Map<string, ExpenseEditorDraft>();
  private acquisitionTasks = new Map<string, Promise<void>>();

  constructor(private readonly store: DraftStore = LocalDataStore) {}

  persist(state: ExpenseEditorDraft): Promise<void> {
    if (this.acquisitions.has(state.id)) {
      this.acquisitions.set(state.id, state);
      return this.acquisitionTasks.get(state.id)!;
    }
    return this.enqueue(() => this.write(state));
  }

  acquire(state: ExpenseEditorDraft, target: 'photos' | 'smart' | 'receipt', language: 'en' | 'fr' | 'ar', operation: () => Promise<AttachmentDraft[]>, accept = () => true): Promise<AttachmentDraft[]> {
    if (this.acquisitions.has(state.id)) return Promise.reject(new Error('EXPENSE_DRAFT_ACQUISITION_IN_PROGRESS'));
    this.acquisitions.set(state.id, state);
    let photos: AttachmentDraft[] = [];
    const task = this.enqueue(async () => {
      try {
        if (this.closedIds.has(state.id)) throw new Error('EXPENSE_DRAFT_CLOSED');
        await this.write(state);
        try { photos = await operation(); }
        finally { await cleanupNativeAcquisitionFiles(); }
        await this.drainAcquisition(state.id, target, language, photos, accept);
        if (!accept()) photos = [];
      } catch (error) {
        // Acquiring a replacement can fail after manual fields changed. Protect
        // that latest work before reporting the acquisition failure.
        await this.drainAcquisition(state.id, target, language, photos, accept);
        throw error;
      } finally {
        this.acquisitions.delete(state.id);
        this.acquisitionTasks.delete(state.id);
      }
    });
    this.acquisitionTasks.set(state.id, task);
    return task.then(() => photos);
  }

  private async drainAcquisition(id: string, target: 'photos' | 'smart' | 'receipt', language: 'en' | 'fr' | 'ar', photos: AttachmentDraft[], accept: () => boolean): Promise<void> {
    for (;;) {
      const latest = this.acquisitions.get(id)!;
      const accepted = accept();
      const picked = accepted ? photos : [];
      const next = !accepted && target !== 'photos'
        ? { ...latest, [target]: null }
        : picked.length === 0 ? latest : target === 'photos'
          ? { ...latest, attachments: latest.attachments.concat(picked.filter(photo => !latest.attachments.includes(photo))) }
          : { ...latest, [target]: { photo: picked[0], result: null, interrupted: false, currencyCode: latest.currencyCode, language } };
      await this.write(next);
      // Acknowledgments include edits/Remove arriving while the encrypted write
      // was pending, even if authentication destroyed the original component.
      if (this.acquisitions.get(id) === latest && accept() === accepted) return;
    }
  }

  // Reserve the entire Save, including private-media promotion, before unlock can
  // restore another editor. A killed process still retains the last SQLCipher draft.
  commit(state: ExpenseEditorDraft, save: () => Promise<void>): Promise<void> {
    return this.enqueue(async () => {
      if (this.closedIds.has(state.id)) throw new Error('EXPENSE_DRAFT_CLOSED');
      await this.write(state);
      await save();
      this.closedIds.add(state.id);
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async write(state: ExpenseEditorDraft): Promise<void> {
      if (this.closedIds.has(state.id)) return;
      const photos = new Map<string, { meta: StoredDraftPhoto; data: string }>();
      const photoId = async (photo: AttachmentDraft | null): Promise<string | null> => {
        if (!photo) return null;
        let saved = this.photos.get(photo);
        if (!saved) {
          const bytes = new Uint8Array(await photo.blob.arrayBuffer());
          try {
            const { blob: _blob, ...meta } = photo;
            saved = { meta: { ...meta, id: crypto.randomUUID() }, data: encode(bytes) };
          } finally { bytes.fill(0); }
          this.photos.set(photo, saved);
        }
        photos.set(saved.meta.id, saved);
        return saved.meta.id;
      };
      const tool = async <T>(value: DraftToolState<T> | null) => value ? {
        result: value.result, interrupted: value.interrupted,
        currencyCode: value.currencyCode, language: value.language,
        photoId: await photoId(value.photo),
      } : null;
      const attachmentIds: string[] = [];
      for (const photo of state.attachments) attachmentIds.push((await photoId(photo))!);
      const { attachments: _attachments, smart, receipt, ...fields } = state;
      const stored: StoredExpenseDraft = { ...fields, attachmentIds, photos: [], smart: await tool(smart), receipt: await tool(receipt) };
      stored.photos = [...photos.values()].map(p => p.meta);
      await this.store.writeExpenseDraft({ draft: validateStoredDraft(stored), media: Object.fromEntries([...photos.values()].map(p => [p.meta.id, p.data])) });
  }

  async restore(): Promise<ExpenseEditorDraft | null> {
    await this.queue;
    const media = await this.store.readExpenseDraftMedia();
    const stored = this.store.getExpenseDraft();
    if (!stored) return null;
    const photos = new Map<string, AttachmentDraft>();
    for (const meta of stored.photos) {
      const encoded = media[meta.id];
      if (!encoded) throw new Error('EXPENSE_DRAFT_MEDIA_MISSING');
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      if (bytes.length !== meta.byteSize) throw new Error('EXPENSE_DRAFT_MEDIA_INVALID');
      const { id: _id, ...fields } = meta;
      const photo: AttachmentDraft = { ...fields, blob: new Blob([bytes], { type: meta.mimeType }) };
      bytes.fill(0);
      this.photos.set(photo, { meta, data: encoded });
      photos.set(meta.id, photo);
    }
    const hydrate = <T>(tool: { photoId: string | null; result: T | null; interrupted: boolean; currencyCode: string; language: 'en' | 'fr' | 'ar' } | null): DraftToolState<T> | null => tool ? {
      photo: tool.photoId ? photos.get(tool.photoId)! : null,
      result: tool.result, interrupted: tool.interrupted, currencyCode: tool.currencyCode, language: tool.language,
    } : null;
    const { attachmentIds, photos: _photos, smart, receipt, ...fields } = stored;
    return { ...fields, attachments: attachmentIds.map(id => photos.get(id)!), smart: hydrate(smart), receipt: hydrate(receipt) };
  }

  discard(id?: string): Promise<void> {
    return this.enqueue(async () => {
      await this.store.discardExpenseDraft(id);
      if (id) this.closedIds.add(id);
    });
  }
}

export const expenseDraftRecoveryService = new ExpenseDraftRecoveryService();
