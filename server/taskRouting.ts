export const GEMINI_TASKS = ['smart-capture', 'scan-receipt', 'analyze', 'explain-trends'] as const;
export type GeminiTask = typeof GEMINI_TASKS[number];
export interface TaskRoute { models: string[]; thinkingLevel?: 'low' | 'high' }
export type GeminiTaskRoutes = Partial<Record<GeminiTask, TaskRoute>>;
// Google deprecated 3.7 on 2026-10-09 and routes it to 3.8. It is not model diversity.
export function canonicalModel(model: string): string {
  return model === 'gemini-3.7-flash' ? 'gemini-3.8-flash' : model;
}
/** WP36 EN/FR/AR synthetic qualification, 2026-10-11; see WP36_REVIEW.md.
 * Statistics is a verified-fact selector, never free-form numerical reasoning.
 * Explicit operator model/route overrides still take precedence in config.ts.
 */
export function qualifiedDefaultTaskRoutes(maxAttempts: number): GeminiTaskRoutes {
  return Object.fromEntries(GEMINI_TASKS.map(task => [task, {
    models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'].slice(0, maxAttempts), thinkingLevel: 'low',
  }]));
}
// Documented low/high support checked 2026-10-10. Availability is separately
// attested per project; prefix matching alone cannot establish parameter support.
const LOW_HIGH_MODELS = new Set(['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3-pro-preview']);

// No candidate is selected by a profile change. Explicit operator attestation
// follows project-specific synthetic quality verification, recorded in the runbook.
export function parseTaskRoutes(env: NodeJS.ProcessEnv): GeminiTaskRoutes {
  if (!env.GEMINI_TASK_ROUTES?.trim()) return {};
  if (env.GEMINI_ROUTING_QUALITY_APPROVED !== 'true') throw new Error('Task routing requires verified quality gates.');
  const verified = new Set((env.GEMINI_VERIFIED_MODELS || '').split(',').map(m => m.trim()).filter(Boolean));
  let routes: any;
  try { routes = JSON.parse(env.GEMINI_TASK_ROUTES); } catch { throw new Error('Invalid Gemini task routing JSON.'); }
  if (!routes || typeof routes !== 'object' || Array.isArray(routes)) throw new Error('Invalid Gemini task routing.');
  const out: GeminiTaskRoutes = {};
  for (const [task, raw] of Object.entries(routes)) {
    const r = raw as any;
    if (!(GEMINI_TASKS as readonly string[]).includes(task) || !r || !Array.isArray(r.models) || r.models.length < 1 || r.models.length > 3 ||
        r.models.some((m: unknown) => typeof m !== 'string' || !/^gemini-[a-z0-9.-]{1,80}$/.test(m) || !verified.has(m)) ||
        Object.keys(r).some(k => k !== 'models' && k !== 'thinkingLevel') ||
        r.thinkingLevel != null && (!['low', 'high'].includes(r.thinkingLevel) || r.models.some((m: string) => !LOW_HIGH_MODELS.has(m)))) throw new Error('Unverified or unsupported Gemini task route.');
    const models = r.models.map(canonicalModel);
    if (new Set(models).size !== models.length) throw new Error('Task models must be distinct, not aliases.');
    if (r.models.some((m: string) => m !== canonicalModel(m))) throw new Error('Task route uses a deprecated model alias; qualify its canonical model.');
    out[task as GeminiTask] = { models, ...(r.thinkingLevel ? { thinkingLevel: r.thinkingLevel } : {}) };
  }
  return out;
}
export function taskForEndpoint(endpoint: string): GeminiTask {
  const task = endpoint.split('/').at(-1);
  if (!(GEMINI_TASKS as readonly unknown[]).includes(task)) throw new Error('Unknown Gemini task.');
  return task as GeminiTask;
}
