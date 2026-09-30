/**
 * WP27 contract only. Native authentication is implemented by WP28.
 *
 * This service will coordinate locked/unlocked protected session state,
 * fresh-auth requirements, and protected-data-session lifecycle.
 */
export type SecureSessionState = 'locked' | 'unlocked';

export interface SecureSessionService {
  getState(): SecureSessionState;
  lock(): void;
}
