import { createHash, randomBytes } from 'crypto';

const processSalt =
  process.env.SPENDWISE_TELEMETRY_SALT?.trim() ||
  randomBytes(32).toString('base64url');

export function securityScopeHash(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHash('sha256')
    .update(processSalt)
    .update(':')
    .update(value)
    .digest('hex')
    .slice(0, 16);
}

export function logSecurityEvent(
  event: string,
  details: {
    scope?: string;
    route?: string;
    code?: string;
    count?: number;
  } = {}
) {
  // Metadata only. This API deliberately does not accept request bodies,
  // authorization credentials, AI payloads, or financial fields.
  console.warn('[Security]', {
    event: event.slice(0, 80),
    scopeHash: securityScopeHash(details.scope),
    route: details.route?.slice(0, 120),
    code: details.code?.slice(0, 80),
    count: details.count,
  });
}
