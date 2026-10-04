import { createHash, randomBytes } from 'crypto';
import { boundedLog } from '../observability/safeLogging';
import { operationalAggregates } from '../observability/aggregates';

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
  operationalAggregates.recordFailure(event);
  if (event === 'ai_global_cost_guardrail') operationalAggregates.recordFailure('GLOBAL_QUOTA_REJECTED');
  if (event === 'ai_installation_daily_limited') operationalAggregates.recordFailure('INSTALLATION_QUOTA_REJECTED');
  boundedLog('Security', {
    event,
    scopeHash: securityScopeHash(details.scope),
    route: details.route,
    code: details.code,
    count: details.count,
  });
}
