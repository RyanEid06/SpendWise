/**
 * WP27 contract only. Android Keystore behavior is implemented by WP28.
 *
 * This service will own secure-key aliases, generation, wrapping/unwrapping,
 * rotation, and permanent invalidation classification. UI code must never
 * receive raw DB/media keys through this interface.
 */
export interface SecureKeyService {
  readonly implementation: 'unimplemented-wp27-contract';
}
