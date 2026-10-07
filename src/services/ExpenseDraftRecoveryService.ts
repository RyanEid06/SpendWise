import type { AttachmentDraft } from '../utils/attachmentStorage';
import { LocalDataStore, type LocalDataStoreImpl } from '../utils/localDataStore';
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

  constructor(private readonly store: DraftStore = LocalDataStore) {}

  persist(state: ExpenseEditorDraft): Promise<void> {
    const task = this.queue.then(async () => {
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
    });
    this.queue = task.catch(() => undefined);
    return task;
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

  async discard(id: string): Promise<void> {
    await this.queue;
    await this.store.discardExpenseDraft(id);
  }
}

export const expenseDraftRecoveryService = new ExpenseDraftRecoveryService();
