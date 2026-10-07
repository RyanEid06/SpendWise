import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeAuthenticationStatus = 'success' | 'cancelled' | 'unavailable' | 'error';
export type NativeKeyStatus =
  | 'present'
  | 'missing'
  | 'invalidated'
  | 'unrecoverable'
  | 'unavailable'
  | 'error';

export interface NativeAuthenticationResult {
  status: NativeAuthenticationStatus;
  code?: string;
  message?: string;
  postAuthKeyVerifyDurationMs?: number;
}

export interface NativeKeyResult {
  status: NativeKeyStatus;
  alias: string;
  keyVersion: number;
  authenticationRequired: boolean;
  code?: string;
  message?: string;
}

export interface NativeSecurityCapabilities {
  platform: 'android';
  canAuthenticate: boolean;
  biometricStrongAvailable: boolean;
  deviceCredentialAvailable: boolean;
  combinedAuthenticatorsSupported: boolean;
}

export interface NativeWrappedSecret {
  format: 'spendwise-wrap-v1';
  keyVersion: number;
  alias: string;
  purpose: string;
  nonceBase64: string;
  ciphertextBase64: string;
}

export interface NativeInstallationIdentity {
  algorithm: 'ECDSA_P256_SHA256';
  publicKeyBase64: string;
}

export interface NativeInstallationSignature {
  signatureBase64: string;
}

interface SpendWiseSecurityPlugin {
  getCapabilities(): Promise<NativeSecurityCapabilities>;
  authenticate(options: {
    title: string;
    subtitle?: string;
    reason: string;
  }): Promise<NativeAuthenticationResult>;
  ensureKey(options: {
    keyVersion: number;
    authenticationRequired: boolean;
  }): Promise<NativeKeyResult>;
  getKeyStatus(options: {
    keyVersion: number;
    authenticationRequired: boolean;
  }): Promise<NativeKeyResult>;
  verifyKey(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    title: string;
    reason: string;
  }): Promise<NativeAuthenticationResult & { keyStatus?: NativeKeyStatus }>;
  generateWrappedSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    byteLength: number;
    title: string;
    reason: string;
    authenticate?: boolean;
  }): Promise<
    NativeAuthenticationResult & {
      wrapped?: NativeWrappedSecret;
      keyStatus?: NativeKeyStatus;
    }
  >;
  wrapSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    secretBase64: string;
    title: string;
    reason: string;
    authenticate?: boolean;
  }): Promise<
    NativeAuthenticationResult & {
      wrapped?: NativeWrappedSecret;
      keyStatus?: NativeKeyStatus;
    }
  >;
  unwrapSecret(options: {
    wrapped: NativeWrappedSecret;
    authenticationRequired: boolean;
    title: string;
    reason: string;
    authenticate?: boolean;
  }): Promise<
    NativeAuthenticationResult & {
      secretBase64?: string;
      keyStatus?: NativeKeyStatus;
    }
  >;
  deleteKey(options: { keyVersion: number }): Promise<{ deleted: boolean }>;
  ensureInstallationIdentity(): Promise<NativeInstallationIdentity>;
  signInstallationPayload(options: {
    payload: string;
  }): Promise<NativeInstallationSignature>;
  setPrivacyShield(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
}

const NativeSecurity = registerPlugin<SpendWiseSecurityPlugin>('SpendWiseSecurity');

export function isNativeAndroidSecurity(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export class AndroidSecurityAdapter {
  isAvailable(): boolean {
    return isNativeAndroidSecurity();
  }

  async getCapabilities(): Promise<NativeSecurityCapabilities> {
    if (!this.isAvailable()) {
      return {
        platform: 'android',
        canAuthenticate: false,
        biometricStrongAvailable: false,
        deviceCredentialAvailable: false,
        combinedAuthenticatorsSupported: false,
      };
    }
    return NativeSecurity.getCapabilities();
  }

  authenticate(title: string, reason: string): Promise<NativeAuthenticationResult> {
    return NativeSecurity.authenticate({ title, reason });
  }

  ensureKey(
    keyVersion: number,
    authenticationRequired: boolean
  ): Promise<NativeKeyResult> {
    return NativeSecurity.ensureKey({ keyVersion, authenticationRequired });
  }

  getKeyStatus(
    keyVersion: number,
    authenticationRequired: boolean
  ): Promise<NativeKeyResult> {
    return NativeSecurity.getKeyStatus({ keyVersion, authenticationRequired });
  }

  verifyKey(
    keyVersion: number,
    authenticationRequired: boolean,
    title: string,
    reason: string
  ): Promise<NativeAuthenticationResult & { keyStatus?: NativeKeyStatus }> {
    return NativeSecurity.verifyKey({
      keyVersion,
      authenticationRequired,
      title,
      reason,
    });
  }

  generateWrappedSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    byteLength: number;
    title: string;
    reason: string;
    authenticate?: boolean;
  }) {
    return NativeSecurity.generateWrappedSecret(options);
  }

  wrapSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    secretBase64: string;
    title: string;
    reason: string;
    authenticate?: boolean;
  }) {
    return NativeSecurity.wrapSecret(options);
  }

  unwrapSecret(options: {
    wrapped: NativeWrappedSecret;
    authenticationRequired: boolean;
    title: string;
    reason: string;
    authenticate?: boolean;
  }) {
    return NativeSecurity.unwrapSecret(options);
  }

  deleteKey(keyVersion: number): Promise<{ deleted: boolean }> {
    return NativeSecurity.deleteKey({ keyVersion });
  }

  ensureInstallationIdentity(): Promise<NativeInstallationIdentity> {
    return NativeSecurity.ensureInstallationIdentity();
  }

  signInstallationPayload(
    payload: string
  ): Promise<NativeInstallationSignature> {
    return NativeSecurity.signInstallationPayload({ payload });
  }

  async setPrivacyShield(enabled: boolean): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const result = await NativeSecurity.setPrivacyShield({ enabled });
    return result.enabled;
  }
}

export const androidSecurityAdapter = new AndroidSecurityAdapter();
