const MAGIC = new Uint8Array([0x53, 0x57, 0x4d, 0x31]); // SWM1
const FORMAT_VERSION = 1;
const ALGORITHM_AES_256_GCM = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const FIXED_HEADER_BYTES = 10;
const HEADER_BYTES = FIXED_HEADER_BYTES + NONCE_BYTES;

export interface MediaEnvelopeInfo {
  formatVersion: 1;
  algorithm: 'AES-256-GCM';
  nonce: Uint8Array;
  plaintextLength: number;
}

function requireCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('MEDIA_CRYPTO_UNAVAILABLE');
  }
  return crypto;
}

function requireAes256Key(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) {
    throw new Error('MEDIA_KEY_INVALID');
  }
}

function hasMagic(bytes: Uint8Array): boolean {
  return MAGIC.every((value, index) => bytes[index] === value);
}

function buildHeader(plaintextLength: number, nonce: Uint8Array): Uint8Array {
  if (!Number.isInteger(plaintextLength) || plaintextLength < 0 || plaintextLength > 0xffffffff) {
    throw new Error('MEDIA_PLAINTEXT_SIZE_INVALID');
  }
  if (nonce.byteLength !== NONCE_BYTES) throw new Error('MEDIA_NONCE_INVALID');

  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  header[4] = FORMAT_VERSION;
  header[5] = ALGORITHM_AES_256_GCM;
  new DataView(header.buffer).setUint32(6, plaintextLength, false);
  header.set(nonce, FIXED_HEADER_BYTES);
  return header;
}

export function inspectMediaEnvelope(bytes: Uint8Array): MediaEnvelopeInfo {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES + TAG_BYTES) {
    throw new Error('MEDIA_ENVELOPE_TRUNCATED');
  }
  if (!hasMagic(bytes)) throw new Error('MEDIA_ENVELOPE_MAGIC_INVALID');
  if (bytes[4] !== FORMAT_VERSION) throw new Error('MEDIA_ENVELOPE_VERSION_UNSUPPORTED');
  if (bytes[5] !== ALGORITHM_AES_256_GCM) throw new Error('MEDIA_ENVELOPE_ALGORITHM_UNSUPPORTED');

  const plaintextLength = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    FIXED_HEADER_BYTES
  ).getUint32(6, false);
  const encryptedLength = bytes.byteLength - HEADER_BYTES;
  if (encryptedLength !== plaintextLength + TAG_BYTES) {
    throw new Error('MEDIA_ENVELOPE_LENGTH_INVALID');
  }

  return {
    formatVersion: 1,
    algorithm: 'AES-256-GCM',
    nonce: bytes.slice(FIXED_HEADER_BYTES, HEADER_BYTES),
    plaintextLength,
  };
}

export async function encryptMediaBytes(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  requireAes256Key(key);
  if (!(plaintext instanceof Uint8Array)) throw new Error('MEDIA_PLAINTEXT_INVALID');

  const webCrypto = requireCrypto();
  const nonce = new Uint8Array(NONCE_BYTES);
  webCrypto.getRandomValues(nonce);
  const header = buildHeader(plaintext.byteLength, nonce);
  const cryptoKey = await webCrypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = new Uint8Array(
    await webCrypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: header,
        tagLength: TAG_BYTES * 8,
      },
      cryptoKey,
      plaintext
    )
  );

  const envelope = new Uint8Array(header.byteLength + encrypted.byteLength);
  envelope.set(header, 0);
  envelope.set(encrypted, header.byteLength);
  return envelope;
}

export async function decryptMediaBytes(
  envelope: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  requireAes256Key(key);
  const info = inspectMediaEnvelope(envelope);
  const header = envelope.slice(0, HEADER_BYTES);
  const encrypted = envelope.slice(HEADER_BYTES);
  const webCrypto = requireCrypto();
  const cryptoKey = await webCrypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  try {
    const plaintext = new Uint8Array(
      await webCrypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: info.nonce,
          additionalData: header,
          tagLength: TAG_BYTES * 8,
        },
        cryptoKey,
        encrypted
      )
    );
    if (plaintext.byteLength !== info.plaintextLength) {
      plaintext.fill(0);
      throw new Error('MEDIA_ENVELOPE_LENGTH_INVALID');
    }
    return plaintext;
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_ENVELOPE_LENGTH_INVALID') {
      throw error;
    }
    throw new Error('MEDIA_AUTHENTICATION_FAILED');
  }
}

export function isEncryptedMediaEnvelope(bytes: Uint8Array): boolean {
  return bytes.byteLength >= MAGIC.byteLength && hasMagic(bytes);
}
