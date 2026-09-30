import { argon2id } from 'hash-wasm';
import {
  MAX_BACKUP_V2_ARCHIVE_BYTES,
  type BackupV2Preview,
  type BackupV2RestoreAdapters,
  type BackupV2RestoreSummary,
  previewValidatedBackupV2,
  readValidatedBackupMedia,
  restoreBackupV2WithAdapters,
  validateBackupV2Archive,
} from './backupV2';

export const BACKUP_V3_FORMAT = 'spendwise-backup-v3';
export const BACKUP_V3_VERSION = 3;
export const BACKUP_V3_KDF_VERSION = 1;
export const BACKUP_V3_HEADER_MAX_BYTES = 8 * 1024;
export const MAX_BACKUP_V3_ENVELOPE_BYTES = MAX_BACKUP_V2_ARCHIVE_BYTES + 64 * 1024;

export const BACKUP_V3_KDF = {
  algorithm: 'argon2id' as const,
  parametersVersion: BACKUP_V3_KDF_VERSION,
  memorySizeKiB: 19_456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

const KDF_BOUNDS = {
  minMemorySizeKiB: 16 * 1024,
  maxMemorySizeKiB: 64 * 1024,
  minIterations: 2,
  maxIterations: 4,
  minParallelism: 1,
  maxParallelism: 2,
} as const;

const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BITS = 128;
const PREFIX_BYTES = 9;
const MAGIC = new Uint8Array([0x53, 0x57, 0x42, 0x33]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export interface BackupV3Header {
  format: typeof BACKUP_V3_FORMAT;
  formatVersion: typeof BACKUP_V3_VERSION;
  headerVersion: 1;
  kdf: {
    algorithm: 'argon2id';
    parametersVersion: typeof BACKUP_V3_KDF_VERSION;
    memorySizeKiB: number;
    iterations: number;
    parallelism: number;
    hashLength: number;
    saltBase64: string;
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    nonceBase64: string;
    tagLengthBits: typeof AES_GCM_TAG_BITS;
  };
  payload: {
    format: 'spendwise-backup-v2-zip';
    mediaIncluded: boolean;
    plaintextBytes: number;
  };
}

export interface BackupV3Preview extends Omit<BackupV2Preview, 'schemaVersion'> {
  schemaVersion: 3;
}

export interface BackupV3RestoreSummary extends Omit<BackupV2RestoreSummary, 'schemaVersion'> {
  schemaVersion: 3;
}

interface ParsedEnvelope {
  header: BackupV3Header;
  headerBytes: Uint8Array;
  ciphertext: Uint8Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cryptoObject(): Crypto {
  const value = globalThis.crypto;
  if (!value?.getRandomValues || !value.subtle) {
    throw new Error('BACKUP_V3_CRYPTO_UNAVAILABLE');
  }
  return value;
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  cryptoObject().getRandomValues(bytes);
  return bytes;
}

function cryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function decodeBase64(value: unknown, expectedLength: number, errorCode: string): Uint8Array {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 256 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error(errorCode);
  }
  let decoded: string;
  try {
    decoded = atob(value);
  } catch {
    throw new Error(errorCode);
  }
  if (decoded.length !== expectedLength) throw new Error(errorCode);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function validatePassphrase(passphrase: string, creating: boolean): void {
  if (typeof passphrase !== 'string' || passphrase.length > 256) {
    throw new Error('BACKUP_V3_PASSPHRASE_INVALID');
  }
  const length = Array.from(passphrase).length;
  if (length === 0 || (creating && length < 8)) {
    throw new Error('BACKUP_V3_PASSPHRASE_INVALID');
  }
}

function validateHeader(input: unknown): BackupV3Header {
  if (!isRecord(input)) throw new Error('BACKUP_V3_HEADER_INVALID');
  if (input.format !== BACKUP_V3_FORMAT) throw new Error('BACKUP_V3_FORMAT_INVALID');
  if (input.formatVersion !== BACKUP_V3_VERSION) throw new Error('BACKUP_V3_VERSION_UNSUPPORTED');
  if (input.headerVersion !== 1) throw new Error('BACKUP_V3_HEADER_VERSION_UNSUPPORTED');
  if (!isRecord(input.kdf) || !isRecord(input.cipher) || !isRecord(input.payload)) {
    throw new Error('BACKUP_V3_HEADER_INVALID');
  }

  const kdf = input.kdf;
  if (
    kdf.algorithm !== BACKUP_V3_KDF.algorithm ||
    kdf.parametersVersion !== BACKUP_V3_KDF_VERSION ||
    !Number.isSafeInteger(kdf.memorySizeKiB) ||
    !Number.isSafeInteger(kdf.iterations) ||
    !Number.isSafeInteger(kdf.parallelism) ||
    kdf.hashLength !== 32 ||
    Number(kdf.memorySizeKiB) < KDF_BOUNDS.minMemorySizeKiB ||
    Number(kdf.memorySizeKiB) > KDF_BOUNDS.maxMemorySizeKiB ||
    Number(kdf.iterations) < KDF_BOUNDS.minIterations ||
    Number(kdf.iterations) > KDF_BOUNDS.maxIterations ||
    Number(kdf.parallelism) < KDF_BOUNDS.minParallelism ||
    Number(kdf.parallelism) > KDF_BOUNDS.maxParallelism
  ) {
    throw new Error('BACKUP_V3_KDF_PARAMETERS_INVALID');
  }
  decodeBase64(kdf.saltBase64, BACKUP_V3_KDF.saltLength, 'BACKUP_V3_SALT_INVALID');

  const cipher = input.cipher;
  if (
    cipher.algorithm !== 'AES-256-GCM' ||
    cipher.tagLengthBits !== AES_GCM_TAG_BITS
  ) {
    throw new Error('BACKUP_V3_CIPHER_INVALID');
  }
  decodeBase64(cipher.nonceBase64, AES_GCM_NONCE_BYTES, 'BACKUP_V3_NONCE_INVALID');

  const payload = input.payload;
  if (
    payload.format !== 'spendwise-backup-v2-zip' ||
    typeof payload.mediaIncluded !== 'boolean' ||
    !Number.isSafeInteger(payload.plaintextBytes) ||
    Number(payload.plaintextBytes) <= 0 ||
    Number(payload.plaintextBytes) > MAX_BACKUP_V2_ARCHIVE_BYTES
  ) {
    throw new Error('BACKUP_V3_PAYLOAD_METADATA_INVALID');
  }

  return input as unknown as BackupV3Header;
}

async function parseEnvelope(input: Blob): Promise<ParsedEnvelope> {
  if (!input || input.size < PREFIX_BYTES + 16 || input.size > MAX_BACKUP_V3_ENVELOPE_BYTES) {
    throw new Error('BACKUP_V3_ENVELOPE_SIZE_INVALID');
  }
  const bytes = new Uint8Array(await input.arrayBuffer());
  for (let index = 0; index < MAGIC.length; index++) {
    if (bytes[index] !== MAGIC[index]) throw new Error('BACKUP_V3_FORMAT_INVALID');
  }
  if (bytes[4] !== BACKUP_V3_VERSION) throw new Error('BACKUP_V3_VERSION_UNSUPPORTED');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(5, false);
  if (headerLength <= 0 || headerLength > BACKUP_V3_HEADER_MAX_BYTES) {
    throw new Error('BACKUP_V3_HEADER_SIZE_INVALID');
  }
  const ciphertextOffset = PREFIX_BYTES + headerLength;
  if (ciphertextOffset + 16 > bytes.byteLength) throw new Error('BACKUP_V3_ENVELOPE_TRUNCATED');

  const headerBytes = bytes.slice(PREFIX_BYTES, ciphertextOffset);
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(headerBytes));
  } catch {
    throw new Error('BACKUP_V3_HEADER_INVALID');
  }
  const header = validateHeader(parsed);
  const ciphertext = bytes.slice(ciphertextOffset);
  if (ciphertext.length !== header.payload.plaintextBytes + AES_GCM_TAG_BITS / 8) {
    throw new Error('BACKUP_V3_ENVELOPE_TRUNCATED');
  }
  return { header, headerBytes, ciphertext };
}

async function deriveAesKey(passphrase: string, header: BackupV3Header): Promise<{ key: CryptoKey; raw: Uint8Array }> {
  const salt = decodeBase64(header.kdf.saltBase64, BACKUP_V3_KDF.saltLength, 'BACKUP_V3_SALT_INVALID');
  let raw: Uint8Array | null = null;
  try {
    const derived = await argon2id({
      password: passphrase,
      salt,
      parallelism: header.kdf.parallelism,
      iterations: header.kdf.iterations,
      memorySize: header.kdf.memorySizeKiB,
      hashLength: header.kdf.hashLength,
      outputType: 'binary',
    });
    if (!(derived instanceof Uint8Array) || derived.byteLength !== 32) {
      throw new Error('BACKUP_V3_KDF_FAILED');
    }
    raw = derived;
    const copy = new Uint8Array(raw);
    const key = await cryptoObject().subtle.importKey(
      'raw',
      copy,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    copy.fill(0);
    return { key, raw };
  } finally {
    salt.fill(0);
  }
}

async function decryptParsedEnvelope(
  parsed: ParsedEnvelope,
  passphrase: string
): Promise<Blob> {
  validatePassphrase(passphrase, false);
  const nonce = decodeBase64(parsed.header.cipher.nonceBase64, AES_GCM_NONCE_BYTES, 'BACKUP_V3_NONCE_INVALID');
  const derived = await deriveAesKey(passphrase, parsed.header);
  try {
    let plaintextBuffer: ArrayBuffer;
    try {
      plaintextBuffer = await cryptoObject().subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: cryptoBuffer(nonce),
          additionalData: cryptoBuffer(parsed.headerBytes),
          tagLength: AES_GCM_TAG_BITS,
        },
        derived.key,
        cryptoBuffer(parsed.ciphertext)
      );
    } catch {
      throw new Error('BACKUP_WRONG_PASSPHRASE_OR_TAMPER');
    }
    const plaintext = new Uint8Array(plaintextBuffer);
    if (plaintext.byteLength !== parsed.header.payload.plaintextBytes) {
      plaintext.fill(0);
      throw new Error('BACKUP_V3_PAYLOAD_SIZE_MISMATCH');
    }
    const blob = new Blob([plaintext], { type: 'application/zip' });
    plaintext.fill(0);
    return blob;
  } finally {
    nonce.fill(0);
    derived.raw.fill(0);
  }
}

async function validateV3Payload(payload: Blob, expectedMediaIncluded: boolean) {
  const validated = await validateBackupV2Archive(payload);
  if (validated.manifest.mediaIncluded !== expectedMediaIncluded) {
    throw new Error('BACKUP_V3_PAYLOAD_MODE_MISMATCH');
  }

  if (validated.manifest.mediaIncluded) {
    for (const attachment of validated.manifest.attachments) {
      const blob = await readValidatedBackupMedia(validated, attachment);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const jpegLike =
        bytes.byteLength >= 4 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[bytes.length - 2] === 0xff &&
        bytes[bytes.length - 1] === 0xd9;
      bytes.fill(0);
      if (!jpegLike) throw new Error('BACKUP_V3_MEDIA_CORRUPT');
    }
  }
  return validated;
}

export async function isBackupV3Envelope(input: Blob): Promise<boolean> {
  if (!input || input.size < MAGIC.length + 1) return false;
  const bytes = new Uint8Array(await input.slice(0, MAGIC.length + 1).arrayBuffer());
  return (
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2] &&
    bytes[3] === MAGIC[3]
  );
}

export async function createBackupV3Envelope(options: {
  payload: Blob;
  passphrase: string;
  mediaIncluded: boolean;
}): Promise<Blob> {
  validatePassphrase(options.passphrase, true);
  if (!options.payload || options.payload.size <= 0 || options.payload.size > MAX_BACKUP_V2_ARCHIVE_BYTES) {
    throw new Error('BACKUP_V3_PAYLOAD_SIZE_INVALID');
  }

  const validated = await validateBackupV2Archive(options.payload);
  if (validated.manifest.mediaIncluded !== options.mediaIncluded) {
    throw new Error('BACKUP_V3_PAYLOAD_MODE_MISMATCH');
  }

  const salt = secureRandomBytes(BACKUP_V3_KDF.saltLength);
  const nonce = secureRandomBytes(AES_GCM_NONCE_BYTES);
  const header: BackupV3Header = {
    format: BACKUP_V3_FORMAT,
    formatVersion: BACKUP_V3_VERSION,
    headerVersion: 1,
    kdf: {
      algorithm: BACKUP_V3_KDF.algorithm,
      parametersVersion: BACKUP_V3_KDF.parametersVersion,
      memorySizeKiB: BACKUP_V3_KDF.memorySizeKiB,
      iterations: BACKUP_V3_KDF.iterations,
      parallelism: BACKUP_V3_KDF.parallelism,
      hashLength: BACKUP_V3_KDF.hashLength,
      saltBase64: encodeBase64(salt),
    },
    cipher: {
      algorithm: 'AES-256-GCM',
      nonceBase64: encodeBase64(nonce),
      tagLengthBits: AES_GCM_TAG_BITS,
    },
    payload: {
      format: 'spendwise-backup-v2-zip',
      mediaIncluded: options.mediaIncluded,
      plaintextBytes: options.payload.size,
    },
  };

  const headerBytes = textEncoder.encode(JSON.stringify(header));
  if (headerBytes.byteLength > BACKUP_V3_HEADER_MAX_BYTES) throw new Error('BACKUP_V3_HEADER_SIZE_INVALID');

  const derived = await deriveAesKey(options.passphrase, header);
  const plaintext = new Uint8Array(await options.payload.arrayBuffer());
  try {
    const encrypted = new Uint8Array(
      await cryptoObject().subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: cryptoBuffer(nonce),
          additionalData: cryptoBuffer(headerBytes),
          tagLength: AES_GCM_TAG_BITS,
        },
        derived.key,
        cryptoBuffer(plaintext)
      )
    );
    const output = new Uint8Array(PREFIX_BYTES + headerBytes.byteLength + encrypted.byteLength);
    output.set(MAGIC, 0);
    output[4] = BACKUP_V3_VERSION;
    new DataView(output.buffer).setUint32(5, headerBytes.byteLength, false);
    output.set(headerBytes, PREFIX_BYTES);
    output.set(encrypted, PREFIX_BYTES + headerBytes.byteLength);
    return new Blob([output], { type: 'application/octet-stream' });
  } finally {
    plaintext.fill(0);
    salt.fill(0);
    nonce.fill(0);
    derived.raw.fill(0);
  }
}

export async function decryptBackupV3Envelope(input: Blob, passphrase: string): Promise<Blob> {
  const parsed = await parseEnvelope(input);
  return decryptParsedEnvelope(parsed, passphrase);
}

export async function previewBackupV3Envelope(
  input: Blob,
  passphrase: string
): Promise<BackupV3Preview> {
  const parsed = await parseEnvelope(input);
  const payload = await decryptParsedEnvelope(parsed, passphrase);
  const validated = await validateV3Payload(payload, parsed.header.payload.mediaIncluded);
  const preview = previewValidatedBackupV2(validated);
  return { ...preview, schemaVersion: 3 };
}

export async function restoreBackupV3WithAdapters(
  input: Blob,
  passphrase: string,
  replaceExisting: boolean,
  adapters: BackupV2RestoreAdapters
): Promise<BackupV3RestoreSummary> {
  const parsed = await parseEnvelope(input);
  const payload = await decryptParsedEnvelope(parsed, passphrase);
  await validateV3Payload(payload, parsed.header.payload.mediaIncluded);
  const summary = await restoreBackupV2WithAdapters(payload, replaceExisting, adapters);
  return { ...summary, schemaVersion: 3 };
}

export async function readBackupV3Header(input: Blob): Promise<BackupV3Header> {
  return (await parseEnvelope(input)).header;
}
