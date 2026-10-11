export const GEMINI_TASKS = ['smart-capture', 'scan-receipt', 'analyze', 'explain-trends'] as const;
export type GeminiTask = typeof GEMINI_TASKS[number];
export interface TaskRoute { models: string[]; thinkingLevel?: 'low' | 'high' }
export type GeminiTaskRoutes = Partial<Record<GeminiTask, TaskRoute>>;
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
    out[task as GeminiTask] = { models: [...new Set<string>(r.models)], ...(r.thinkingLevel ? { thinkingLevel: r.thinkingLevel } : {}) };
  }
  return out;
}
export function taskForEndpoint(endpoint: string): GeminiTask {
  const task = endpoint.split('/').at(-1);
  if (!(GEMINI_TASKS as readonly unknown[]).includes(task)) throw new Error('Unknown Gemini task.');
  return task as GeminiTask;
}
