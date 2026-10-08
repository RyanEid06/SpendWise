// Browser-only counterpart. Android never enters this path: its draft lives in SQLCipher.
// The origin's nonextractable key is structured-cloned into IndexedDB; only ciphertext
// and photo ciphertext are persisted in IndexedDB. localStorage holds only a small
// presence marker, so accepted photo capacity does not consume its ~5 MiB quota.
let keyPromise: Promise<CryptoKey> | null = null;
function draftKey(): Promise<CryptoKey> {
  if (!keyPromise) keyPromise = new Promise<CryptoKey>((resolve, reject) => {
    const request = indexedDB.open('spendwise_draft_crypto_v1', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('keys')) request.result.createObjectStore('keys');
      if (!request.result.objectStoreNames.contains('envelopes')) request.result.createObjectStore('envelopes');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const db = request.result;
      try {
        const existing = await new Promise<CryptoKey | undefined>((done, fail) => {
          const get = db.transaction('keys').objectStore('keys').get('draft');
          get.onsuccess = () => done(get.result);
          get.onerror = () => fail(get.error);
        });
        if (existing) { resolve(existing); return; }
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await new Promise<void>((done, fail) => {
          const tx = db.transaction('keys', 'readwrite');
          tx.objectStore('keys').put(key, 'draft');
          tx.oncomplete = () => done();
          tx.onabort = tx.onerror = () => fail(tx.error);
        });
        resolve(key);
      } catch (error) { reject(error); }
      finally { db.close(); }
    };
  }).catch(error => { keyPromise = null; throw error; });
  return keyPromise;
}
async function envelope(operation: 'read' | 'write' | 'clear', value?: { iv: Uint8Array; data: ArrayBuffer }): Promise<{ iv: Uint8Array; data: ArrayBuffer } | undefined> {
  await draftKey();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('spendwise_draft_crypto_v1', 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('envelopes', operation === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('envelopes');
      const request = operation === 'read' ? store.get('draft') : operation === 'write' ? store.put(value, 'draft') : store.delete('draft');
      tx.oncomplete = () => resolve(operation === 'read' ? request.result : undefined);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function clearWebDraft(): Promise<void> {
  if (typeof indexedDB !== 'undefined') await envelope('clear');
}
export async function encryptWebDraft(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  try {
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('SpendWise draft v1') }, await draftKey(), bytes);
    await envelope('write', { iv, data });
    return JSON.stringify({ version: 3 });
  } finally { bytes.fill(0); }
}
export async function decryptWebDraft(raw: string): Promise<unknown> {
  const value = JSON.parse(raw);
  const decode = (raw: string) => Uint8Array.from(atob(raw), char => char.charCodeAt(0));
  let iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>;
  if (value.version === 3) {
    const saved = await envelope('read');
    if (!saved) throw new Error('EXPENSE_DRAFT_ENVELOPE_MISSING');
    iv = new Uint8Array(saved.iv); data = new Uint8Array(saved.data);
  } else if (value.version === 2 && typeof value.iv === 'string' && typeof value.data === 'string') {
    iv = decode(value.iv); data = decode(value.data);
  } else if (value.version === 1 && Array.isArray(value.iv) && Array.isArray(value.data)) {
    iv = new Uint8Array(value.iv); data = new Uint8Array(value.data);
  } else throw new Error('EXPENSE_DRAFT_ENVELOPE_INVALID');
  if (iv.length !== 12 || data.length < 16) throw new Error('EXPENSE_DRAFT_ENVELOPE_INVALID');
  const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('SpendWise draft v1') }, await draftKey(), data));
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  finally { bytes.fill(0); }
}
