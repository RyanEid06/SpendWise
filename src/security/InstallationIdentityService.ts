import {
  AndroidSecurityAdapter,
  androidSecurityAdapter,
} from '../platform/android/AndroidSecurityAdapter';

export const INSTALLATION_AUTH_ALGORITHM = 'ECDSA_P256_SHA256' as const;

export interface InstallationPublicIdentity {
  algorithm: typeof INSTALLATION_AUTH_ALGORITHM;
  publicKey: string;
}

export interface InstallationIdentitySigner {
  getPublicIdentity(): Promise<InstallationPublicIdentity>;
  sign(payload: string): Promise<string>;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const value of new Uint8Array(bytes)) binary += String.fromCharCode(value);
  return btoa(binary);
}

class BrowserEphemeralIdentitySigner implements InstallationIdentitySigner {
  private keyPair: Promise<CryptoKeyPair> | null = null;

  private ensureKeyPair(): Promise<CryptoKeyPair> {
    if (!this.keyPair) {
      this.keyPair = crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
      ) as Promise<CryptoKeyPair>;
    }
    return this.keyPair;
  }

  async getPublicIdentity(): Promise<InstallationPublicIdentity> {
    const keyPair = await this.ensureKeyPair();
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return {
      algorithm: INSTALLATION_AUTH_ALGORITHM,
      publicKey: bytesToBase64(spki),
    };
  }

  async sign(payload: string): Promise<string> {
    const keyPair = await this.ensureKeyPair();
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(payload)
    );
    return bytesToBase64(signature);
  }
}

export class DefaultInstallationIdentitySigner
  implements InstallationIdentitySigner
{
  private readonly browserFallback = new BrowserEphemeralIdentitySigner();

  constructor(
    private readonly nativeAdapter: AndroidSecurityAdapter =
      androidSecurityAdapter
  ) {}

  async getPublicIdentity(): Promise<InstallationPublicIdentity> {
    if (this.nativeAdapter.isAvailable()) {
      const identity = await this.nativeAdapter.ensureInstallationIdentity();
      return {
        algorithm: INSTALLATION_AUTH_ALGORITHM,
        publicKey: identity.publicKeyBase64,
      };
    }
    return this.browserFallback.getPublicIdentity();
  }

  async sign(payload: string): Promise<string> {
    if (this.nativeAdapter.isAvailable()) {
      const result =
        await this.nativeAdapter.signInstallationPayload(payload);
      return result.signatureBase64;
    }
    return this.browserFallback.sign(payload);
  }
}

export const installationIdentitySigner: InstallationIdentitySigner =
  new DefaultInstallationIdentitySigner();
