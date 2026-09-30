import { argon2id, argon2Verify } from 'hash-wasm';
import type { WebPinVerifierRecord } from './SecurityStateStore';

export const WEB_PIN_KDF = {
  version: 1 as const,
  memorySizeKiB: 19_456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
} as const;

export function isValidSpendWisePin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error('SECURE_RANDOM_UNAVAILABLE');
  }
  cryptoObject.getRandomValues(bytes);
  return bytes;
}

export class WebPinService {
  async createVerifier(pin: string): Promise<WebPinVerifierRecord> {
    if (!isValidSpendWisePin(pin)) throw new Error('INVALID_PIN');

    const salt = secureRandomBytes(WEB_PIN_KDF.saltLength);
    try {
      const encodedHash = await argon2id({
        password: pin,
        salt,
        parallelism: WEB_PIN_KDF.parallelism,
        iterations: WEB_PIN_KDF.iterations,
        memorySize: WEB_PIN_KDF.memorySizeKiB,
        hashLength: WEB_PIN_KDF.hashLength,
        outputType: 'encoded',
      });

      if (typeof encodedHash !== 'string') throw new Error('ARGON2_ENCODING_FAILED');
      return {
        version: WEB_PIN_KDF.version,
        algorithm: 'argon2id',
        encodedHash,
        memorySizeKiB: WEB_PIN_KDF.memorySizeKiB,
        iterations: WEB_PIN_KDF.iterations,
        parallelism: WEB_PIN_KDF.parallelism,
        hashLength: WEB_PIN_KDF.hashLength,
        createdAt: Date.now(),
      };
    } finally {
      salt.fill(0);
    }
  }

  async verify(pin: string, verifier: WebPinVerifierRecord): Promise<boolean> {
    if (!isValidSpendWisePin(pin)) return false;
    if (verifier.version !== 1 || verifier.algorithm !== 'argon2id') return false;
    return argon2Verify({
      password: pin,
      hash: verifier.encodedHash,
    });
  }
}

export const webPinService = new WebPinService();
