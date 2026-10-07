// Browser-only counterpart. Android never enters this path: its draft lives in SQLCipher.
// The origin's nonextractable key is structured-cloned into IndexedDB; only ciphertext
// is persisted in localStorage or in the existing browser financial transaction journal.
let keyPromise: Promise<CryptoKey> | null = null;
function draftKey(): Promise<CryptoKey> {
  if (!keyPromise) keyPromise = new Promise<CryptoKey>((resolve, reject) => {
    const request = indexedDB.open('spendwise_draft_crypto_v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
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
export async function encryptWebDraft(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  try {
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('SpendWise draft v1') }, await draftKey(), bytes);
    return JSON.stringify({ version: 1, iv: Array.from(iv), data: Array.from(new Uint8Array(data)) });
  } finally { bytes.fill(0); }
}
export async function decryptWebDraft(raw: string): Promise<unknown> {
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.iv) || value.iv.length !== 12 || !Array.isArray(value.data)) throw new Error('EXPENSE_DRAFT_ENVELOPE_INVALID');
  const bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(value.iv), additionalData: new TextEncoder().encode('SpendWise draft v1') }, await draftKey(), new Uint8Array(value.data)));
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  finally { bytes.fill(0); }
}
