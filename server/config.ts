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
}

export function parseServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
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
  const allowedOrigins = new Set(
    (
      env.ALLOWED_ORIGINS ||
      'https://localhost,http://localhost,http://localhost:5173,http://localhost:3000'
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );

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
  };
}

export const serverConfig = parseServerConfig();
