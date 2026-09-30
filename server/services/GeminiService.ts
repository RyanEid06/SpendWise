import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config';
import {
  createAiFailure,
  executeGeminiJsonWithModelFallback,
} from '../geminiReliability';
import { logAiFailure } from '../logging/aiLogging';

export interface GeminiJsonRequest<T> {
  endpoint: string;
  requestId: string;
  contents: any;
  responseJsonSchema: any;
  systemInstruction: string;
  validate: (value: unknown) => T | null;
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

    return executeGeminiJsonWithModelFallback({
      endpoint: request.endpoint,
      requestId: request.requestId,
      models: serverConfig.geminiModels,
      timeoutMs: serverConfig.geminiTimeoutMs,
      retryDelayMs: serverConfig.geminiRetryDelayMs,
      logFailure: logAiFailure,
      request: (model, timeoutMs) =>
        ai.models.generateContent({
          model,
          contents: request.contents,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: request.responseJsonSchema,
            httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
            systemInstruction: request.systemInstruction,
          },
        }),
      validate: request.validate,
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
