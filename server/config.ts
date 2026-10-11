import path from 'path';
import { canonicalModel, parseTaskRoutes, qualifiedDefaultTaskRoutes, type GeminiTaskRoutes } from './taskRouting';

export interface ServerConfig {
  port: number;
  geminiModel: string;
  geminiFallbackModels: string[];
  geminiModels: string[];
  maxImageBase64Length: number;
  rateWindowMs: number;
  rateLimit: number;
  geminiTimeoutMs: number;
  geminiRetryDelayMs: number;
  geminiOperationBudgetMs: number;
  geminiMaxAttempts: number;
  geminiRuntimeProfile: 'free' | 'standard';
  backendHostProfile: 'render_free' | 'always_on';
  geminiTaskRoutes: GeminiTaskRoutes;
  rateBucketMaxEntries: number;
  allowedOrigins: Set<string>;
  production: boolean;
  authChallengeTtlMs: number;
  accessTokenTtlMs: number;
  installationStorePath: string | null;
  authStore: 'file' | 'postgres';
  authDatabaseUrl: string | null;
  deniedInstallationIds: Set<string>;
  legacyApiToken: string | null;
  legacyCompatibilityUntil: string | null;
  legacyCompatibilityUntilMs: number | null;
  registrationHourlyLimit: number;
  registrationDailyLimit: number;
  challengeWindowMs: number;
  challengePerInstallationLimit: number;
  challengePerIpLimit: number;
  aiPerInstallationLimit: number;
  aiPerIpLimit: number;
  aiPerInstallationDailyLimit: number;
  aiGlobalDailyLimit: number;
  maxAuthJsonBodyBytes: number;
  maxFinancialJsonBodyBytes: number;
  maxImageJsonBodyBytes: number;
}

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function csvSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function parseServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  const backendHostProfile = env.BACKEND_HOST_PROFILE || (env.RENDER === 'true' ? 'render_free' : 'always_on');
  if (backendHostProfile !== 'render_free' && backendHostProfile !== 'always_on') throw new Error('Invalid backend host profile.');
  const authStore = env.SPENDWISE_AUTH_STORE || (env.RENDER === 'true' || backendHostProfile === 'render_free' ? 'postgres' : 'file');
  if (authStore !== 'file' && authStore !== 'postgres') throw new Error('Invalid auth store.');
  if ((env.RENDER === 'true' || backendHostProfile === 'render_free') && authStore !== 'postgres') throw new Error('Render requires durable auth storage.');
  const authDatabaseUrl = env.SPENDWISE_AUTH_DATABASE_URL?.trim() || null;
  if (authStore === 'postgres' && !authDatabaseUrl) throw new Error('Missing auth database configuration.');
  const geminiRuntimeProfile = env.GEMINI_RUNTIME_PROFILE || 'free';
  if (geminiRuntimeProfile !== 'free' && geminiRuntimeProfile !== 'standard') throw new Error('Invalid Gemini runtime profile.');
  const port = Number(env.PORT || 3000);
  const geminiModel = canonicalModel((env.GEMINI_MODEL || 'gemini-3.8-flash').trim());
  const geminiFallbackModels = (
    env.GEMINI_FALLBACK_MODELS ??
    env.GEMINI_FALLBACK_MODEL ??
    ''
  )
    .split(',')
    .map((model) => canonicalModel(model.trim()))
    .filter(Boolean);
  const geminiModels = [
    ...new Set([geminiModel, ...geminiFallbackModels].filter(Boolean)),
  ];
  const geminiMaxAttempts = boundedInteger(env.GEMINI_MAX_ATTEMPTS, 2, 1, 3);
  const hasModelOverride = Boolean(env.GEMINI_MODEL?.trim() || env.GEMINI_FALLBACK_MODELS?.trim() || env.GEMINI_FALLBACK_MODEL?.trim() || env.GEMINI_TASK_ROUTES?.trim());
  const geminiTaskRoutes = hasModelOverride ? parseTaskRoutes(env) : qualifiedDefaultTaskRoutes(geminiMaxAttempts);
  if (geminiModels.length > 1) {
    const verified = new Set((env.GEMINI_VERIFIED_MODELS || '').split(',').map(model => model.trim()));
    if (env.GEMINI_ROUTING_QUALITY_APPROVED !== 'true' || geminiModels.some(model => !verified.has(model))) {
      throw new Error('Distinct fallback models require verified quality gates.');
    }
  }
  if (geminiModels.length > geminiMaxAttempts || Object.values(geminiTaskRoutes).some(route => route.models.length > geminiMaxAttempts)) {
    throw new Error('Configured models are unreachable within the global attempt cap.');
  }
  const geminiOperationBudgetMs = boundedInteger(env.GEMINI_OPERATION_BUDGET_MS, 90_000, 15_000, 100_000);
  const geminiTimeoutMs = Math.min(geminiOperationBudgetMs, boundedInteger(env.GEMINI_TIMEOUT_MS, 50_000, 5_000, 60_000));

  const defaultOrigins = production
    ? ['https://localhost']
    : [
        'https://localhost',
        'http://localhost',
        'http://localhost:5173',
        'http://localhost:3000',
        'capacitor://localhost',
      ];
  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : defaultOrigins)
      .map((value) => value.trim())
      .filter(Boolean)
  );

  const storeSetting = env.SPENDWISE_INSTALLATION_STORE_PATH?.trim();
  const installationStorePath =
    storeSetting === ':memory:'
      ? null
      : path.resolve(
          storeSetting ||
            path.join(process.cwd(), '.spendwise-security', 'installations.json')
        );

  const configuredLegacyToken = env.SPENDWISE_API_TOKEN?.trim() || null;
  const configuredLegacyUntil =
    env.SPENDWISE_LEGACY_AUTH_UNTIL?.trim() || null;
  const parsedLegacyUntil = configuredLegacyUntil
    ? Date.parse(configuredLegacyUntil)
    : Number.NaN;
  const legacyCompatibilityUntilMs = Number.isFinite(parsedLegacyUntil)
    ? parsedLegacyUntil
    : null;
  // A legacy bearer is deliberately unusable unless a concrete expiry is
  // configured. This prevents a migration crutch from becoming permanent.
  const legacyApiToken =
    configuredLegacyToken && legacyCompatibilityUntilMs != null
      ? configuredLegacyToken
      : null;

  return {
    port,
    geminiModel,
    geminiFallbackModels,
    geminiModels,
    maxImageBase64Length: 12_000_000,
    rateWindowMs: 60_000,
    rateLimit: 30,
    geminiTimeoutMs,
    geminiOperationBudgetMs,
    geminiMaxAttempts,
    geminiRuntimeProfile,
    backendHostProfile,
    geminiTaskRoutes,
    geminiRetryDelayMs: boundedInteger(env.GEMINI_RETRY_DELAY_MS, 1_000, 250, 4_000),
    rateBucketMaxEntries: 2_000,
    allowedOrigins,
    production,
    authChallengeTtlMs: 120_000,
    accessTokenTtlMs: 10 * 60_000,
    installationStorePath,
    authStore,
    authDatabaseUrl,
    deniedInstallationIds: csvSet(env.SPENDWISE_DENIED_INSTALLATION_IDS),
    legacyApiToken,
    legacyCompatibilityUntil:
      legacyApiToken ? configuredLegacyUntil : null,
    legacyCompatibilityUntilMs:
      legacyApiToken ? legacyCompatibilityUntilMs : null,
    registrationHourlyLimit: boundedInteger(
      env.SPENDWISE_REGISTRATION_HOURLY_LIMIT,
      5,
      1,
      100
    ),
    registrationDailyLimit: boundedInteger(
      env.SPENDWISE_REGISTRATION_DAILY_LIMIT,
      20,
      1,
      500
    ),
    challengeWindowMs: 10 * 60_000,
    challengePerInstallationLimit: boundedInteger(
      env.SPENDWISE_CHALLENGE_INSTALLATION_LIMIT,
      30,
      5,
      300
    ),
    challengePerIpLimit: boundedInteger(
      env.SPENDWISE_CHALLENGE_IP_LIMIT,
      90,
      10,
      1000
    ),
    aiPerInstallationLimit: boundedInteger(
      env.SPENDWISE_AI_INSTALLATION_PER_MINUTE,
      30,
      1,
      300
    ),
    aiPerIpLimit: boundedInteger(
      env.SPENDWISE_AI_IP_PER_MINUTE,
      60,
      1,
      600
    ),
    aiPerInstallationDailyLimit: boundedInteger(
      env.SPENDWISE_AI_INSTALLATION_PER_DAY,
      500,
      10,
      10000
    ),
    aiGlobalDailyLimit: boundedInteger(
      env.SPENDWISE_AI_GLOBAL_PER_DAY,
      5000,
      100,
      100000
    ),
    maxAuthJsonBodyBytes: 64 * 1024,
    maxFinancialJsonBodyBytes: 512 * 1024,
    maxImageJsonBodyBytes: 16 * 1024 * 1024,
  };
}

export const serverConfig = parseServerConfig();
