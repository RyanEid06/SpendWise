import path from 'path';

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
  rateBucketMaxEntries: number;
  allowedOrigins: Set<string>;
  production: boolean;
  authChallengeTtlMs: number;
  accessTokenTtlMs: number;
  installationStorePath: string | null;
  deniedInstallationIds: Set<string>;
  legacyApiToken: string | null;
  legacyCompatibilityUntil: string | null;
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
  const port = Number(env.PORT || 3000);
  const geminiModel = (env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const geminiFallbackModels = (
    env.GEMINI_FALLBACK_MODELS ||
    env.GEMINI_FALLBACK_MODEL ||
    'gemini-3.7-flash,gemini-3.5-flash-lite'
  )
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const geminiModels = [
    ...new Set([geminiModel, ...geminiFallbackModels].filter(Boolean)),
  ];
  const configuredGeminiTimeoutMs = Number(env.GEMINI_TIMEOUT_MS || 22_000);
  const geminiTimeoutMs = Number.isFinite(configuredGeminiTimeoutMs)
    ? Math.max(5_000, Math.min(configuredGeminiTimeoutMs, 40_000))
    : 22_000;

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

  const legacyApiToken = env.SPENDWISE_API_TOKEN?.trim() || null;

  return {
    port,
    geminiModel,
    geminiFallbackModels,
    geminiModels,
    maxImageBase64Length: 12_000_000,
    rateWindowMs: 60_000,
    rateLimit: 30,
    geminiTimeoutMs,
    geminiRetryDelayMs: 350,
    rateBucketMaxEntries: 2_000,
    allowedOrigins,
    production,
    authChallengeTtlMs: 120_000,
    accessTokenTtlMs: 10 * 60_000,
    installationStorePath,
    deniedInstallationIds: csvSet(env.SPENDWISE_DENIED_INSTALLATION_IDS),
    legacyApiToken,
    legacyCompatibilityUntil:
      env.SPENDWISE_LEGACY_AUTH_UNTIL?.trim() || null,
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
