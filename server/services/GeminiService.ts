import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { serverConfig } from '../config';
import {
  createAiFailure,
  executeGeminiJsonWithModelFallback,
  AiReliabilityError,
  normalizeGeminiFailure,
} from '../geminiReliability';
import { taskForEndpoint } from '../taskRouting';
import { matchesGeminiSchema } from '../validation/geminiSchema';
import { logAiFailure } from '../logging/aiLogging';
import { logProviderUsage } from '../logging/providerUsage';
import { operationalAggregates } from '../observability/aggregates';

export interface GeminiJsonRequest<T> {
  endpoint: string;
  requestId: string;
  contents: any;
  responseJsonSchema: any;
  systemInstruction: string;
  validate: (value: unknown) => T | null;
  signal?: AbortSignal;
  deadline?: number;
}

export interface GeminiServiceContract {
  isConfigured(): boolean;
  generateJson<T>(request: GeminiJsonRequest<T>): Promise<T>;
}

export class GeminiService implements GeminiServiceContract {
  isConfigured(): boolean {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  }

  async generateJson<T>(request: GeminiJsonRequest<T>): Promise<T> {
    const ai = this.createClient();
    if (!ai) throw createAiFailure('AI_NOT_CONFIGURED');
    const route = serverConfig.geminiTaskRoutes[taskForEndpoint(request.endpoint)];
    const models = route?.models ?? serverConfig.geminiModels;

    return executeGeminiJsonWithModelFallback({
      endpoint: request.endpoint,
      requestId: request.requestId,
      models,
      signal: request.signal,
      operationBudgetMs: serverConfig.geminiOperationBudgetMs,
      operationDeadline: request.deadline,
      maxAttempts: serverConfig.geminiMaxAttempts,
      timeoutMs: serverConfig.geminiTimeoutMs,
      retryDelayMs: serverConfig.geminiRetryDelayMs,
      logFailure: (details) => {
        if (details.willRetry) operationalAggregates.recordFailure('PROVIDER_RETRY');
      },
      logAttempt: details => {
        logAiFailure(details);
        if (details.code === 'PROVIDER_SUCCESS') logProviderUsage(details);
        operationalAggregates.recordProvider(details.model === models[0] ? 'primary' : 'fallback', details.attemptMs, details.code === 'PROVIDER_SUCCESS');
      },
      logModelFallback: () => operationalAggregates.recordFailure('PROVIDER_FALLBACK'),
      request: async (model, timeoutMs, _attempt, signal) => {
        let retryAfter: string | null = null;
        try {
          const response = await ai.models.generateContent({
            model,
            contents: request.contents,
            config: {
              abortSignal: signal,
              ...(route?.thinkingLevel ? { thinkingConfig: { thinkingLevel: route.thinkingLevel === 'low' ? ThinkingLevel.LOW : ThinkingLevel.HIGH } } : {}),
              responseMimeType: 'application/json',
              responseJsonSchema: request.responseJsonSchema,
              httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 }, fetch: async (url, init) => {
                const response = await fetch(url, init); retryAfter = response.headers.get('Retry-After'); return response;
              } },
              systemInstruction: request.systemInstruction,
            },
          });
          return response;
        } catch (error) {
          if (retryAfter) {
            const normalized = normalizeGeminiFailure(error);
            const guidance = normalizeGeminiFailure({ status: normalized.upstreamStatus, headers: { 'retry-after': retryAfter } });
            throw new AiReliabilityError({ ...normalized, retryAfterMs: Math.max(normalized.retryAfterMs ?? 0, guidance.retryAfterMs ?? 0) });
          }
          throw error;
        }
      },
      validate: value => matchesGeminiSchema(value, request.responseJsonSchema) ? request.validate(value) : null,
    });
  }

  private createClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'SpendWise',
        },
      },
    });
  }
}

export const geminiService: GeminiServiceContract = new GeminiService();
