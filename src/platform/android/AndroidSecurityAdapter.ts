import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  authenticationPrompt, currentAuthenticationLanguage,
  type AuthenticationAction, type AuthenticationMethod,
} from '../../security/authenticationCopy';

export type NativeAuthenticationStatus = 'success' | 'cancelled' | 'unavailable' | 'error';
export type NativeBiometricCondition = 'available' | 'temporary-lockout' | 'permanent-lockout' | 'unavailable';
export type NativeAuthenticationCapability = 'biometric-and-credential' | 'biometric-only' | 'credential-only' | 'unavailable' | 'temporary-lockout' | 'permanent-lockout';
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
  authSucceededAtElapsedRealtimeMs?: number;
  recoveryAvailable?: boolean;
  biometricCondition?: NativeBiometricCondition;
}

export interface NativeKeyResult {
  status: NativeKeyStatus;
  alias: string;
  keyVersion: number;
  authenticationRequired: boolean;
  created?: boolean;
  code?: string;
  message?: string;
}

export interface NativeSecurityCapabilities {
  platform: 'android';
  canAuthenticate: boolean;
  biometricStrongAvailable: boolean;
  deviceCredentialAvailable: boolean;
  combinedAuthenticatorsSupported: boolean;
  credentialOnlySupported?: boolean;
  biometricState?: 'available' | 'none-enrolled' | 'no-hardware' | 'hardware-unavailable' | 'unsupported' | 'unknown';
  apiLevel?: number;
}

export function classifyNativeAuthenticationCapabilities(
  capabilities: NativeSecurityCapabilities,
  condition?: NativeBiometricCondition
): NativeAuthenticationCapability {
  if (condition === 'temporary-lockout' || condition === 'permanent-lockout') return condition;
  if (capabilities.biometricStrongAvailable) return capabilities.deviceCredentialAvailable ? 'biometric-and-credential' : 'biometric-only';
  return capabilities.deviceCredentialAvailable ? 'credential-only' : 'unavailable';
}

interface NativePromptOptions {
  title: string;
  reason: string;
  credentialButton: string;
  cancelButton: string;
  method: AuthenticationMethod;
  lockTimeoutSeconds: number;
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
  getCapabilities(options?: { lockTimeoutSeconds: number }): Promise<NativeSecurityCapabilities>;
  elapsedSinceAuthentication(options: {
    authSucceededAtElapsedRealtimeMs: number;
  }): Promise<{ durationMs: number }>;
  authenticate(options: NativePromptOptions): Promise<NativeAuthenticationResult>;
  cancelAuthentication(): Promise<{ cancelled: boolean }>;
  getAuthenticationLifecycle(): Promise<{ systemCredentialActive: boolean; internalAuthenticationActive?: boolean }>;
  ensureKey(options: {
    keyVersion: number;
    authenticationRequired: boolean;
  }): Promise<NativeKeyResult>;
  getKeyStatus(options: {
    keyVersion: number;
    authenticationRequired: boolean;
  }): Promise<NativeKeyResult>;
  verifyKey(options: NativePromptOptions & {
    keyVersion: number;
    authenticationRequired: boolean;
    title: string;
    reason: string;
  }): Promise<NativeAuthenticationResult & { keyStatus?: NativeKeyStatus }>;
  generateWrappedSecret(options: NativePromptOptions & {
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
  wrapSecret(options: NativePromptOptions & {
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
  unwrapSecret(options: NativePromptOptions & {
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
  constructor(private readonly securityPlugin: SpendWiseSecurityPlugin = NativeSecurity) {}

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
    return this.securityPlugin.getCapabilities({ lockTimeoutSeconds: this.prompt('unlock').lockTimeoutSeconds });
  }

  private prompt(action: AuthenticationAction, method: AuthenticationMethod = 'primary'): NativePromptOptions {
    // Unknown legacy callers receive safe copy; identifiers are never prettified into UI.
    let copy;
    try { copy = authenticationPrompt(action, currentAuthenticationLanguage()); }
    catch { copy = authenticationPrompt('unlock', currentAuthenticationLanguage()); }
    let lockTimeoutSeconds = 300;
    try {
      const stored = Number(localStorage.getItem('spendwise_lock_timeout_seconds') ?? '300');
      if ([0, 60, 300, 900].includes(stored)) lockTimeoutSeconds = stored;
    } catch { /* Use the established default. */ }
    return { title: copy.title, reason: copy.reason, credentialButton: copy.credentialButton, cancelButton: copy.cancelButton, method, lockTimeoutSeconds };
  }

  authenticate(action: AuthenticationAction, method?: AuthenticationMethod): Promise<NativeAuthenticationResult> {
    return this.securityPlugin.authenticate(this.prompt(action, method));
  }

  cancelAuthentication(): Promise<{ cancelled: boolean }> {
    return this.securityPlugin.cancelAuthentication();
  }

  getAuthenticationLifecycle(): Promise<{ systemCredentialActive: boolean; internalAuthenticationActive?: boolean }> {
    return this.securityPlugin.getAuthenticationLifecycle();
  }

  async elapsedSinceAuthentication(authSucceededAtElapsedRealtimeMs: number): Promise<number> {
    const result = await this.securityPlugin.elapsedSinceAuthentication({ authSucceededAtElapsedRealtimeMs });
    return result.durationMs;
  }

  ensureKey(
    keyVersion: number,
    authenticationRequired: boolean
  ): Promise<NativeKeyResult> {
    return this.securityPlugin.ensureKey({ keyVersion, authenticationRequired });
  }

  getKeyStatus(
    keyVersion: number,
    authenticationRequired: boolean
  ): Promise<NativeKeyResult> {
    return this.securityPlugin.getKeyStatus({ keyVersion, authenticationRequired });
  }

  verifyKey(
    keyVersion: number,
    authenticationRequired: boolean,
    action: AuthenticationAction,
    method?: AuthenticationMethod
  ): Promise<NativeAuthenticationResult & { keyStatus?: NativeKeyStatus }> {
    return this.securityPlugin.verifyKey({
      keyVersion,
      authenticationRequired,
      ...this.prompt(action, method),
    });
  }

  generateWrappedSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    byteLength: number;
    action: AuthenticationAction;
    method?: AuthenticationMethod;
    authenticate?: boolean;
  }) {
    const { action, method, ...operation } = options;
    return this.securityPlugin.generateWrappedSecret({ ...operation, ...this.prompt(action, method) });
  }

  wrapSecret(options: {
    keyVersion: number;
    authenticationRequired: boolean;
    purpose: string;
    secretBase64: string;
    action: AuthenticationAction;
    method?: AuthenticationMethod;
    authenticate?: boolean;
  }) {
    const { action, method, ...operation } = options;
    return this.securityPlugin.wrapSecret({ ...operation, ...this.prompt(action, method) });
  }

  unwrapSecret(options: {
    wrapped: NativeWrappedSecret;
    authenticationRequired: boolean;
    action: AuthenticationAction;
    method?: AuthenticationMethod;
    authenticate?: boolean;
  }) {
    const { action, method, ...operation } = options;
    return this.securityPlugin.unwrapSecret({ ...operation, ...this.prompt(action, method) });
  }

  deleteKey(keyVersion: number): Promise<{ deleted: boolean }> {
    return this.securityPlugin.deleteKey({ keyVersion });
  }

  ensureInstallationIdentity(): Promise<NativeInstallationIdentity> {
    return this.securityPlugin.ensureInstallationIdentity();
  }

  signInstallationPayload(
    payload: string
  ): Promise<NativeInstallationSignature> {
    return this.securityPlugin.signInstallationPayload({ payload });
  }

  async setPrivacyShield(enabled: boolean): Promise<boolean> {
    if (!this.isAvailable()) return false;
    const result = await this.securityPlugin.setPrivacyShield({ enabled });
    return result.enabled;
  }
}

export const androidSecurityAdapter = new AndroidSecurityAdapter();
