import { AiAnalysisResult } from '../types';
import { StorageManager } from '../utils/storage';

export interface AnalysisCacheService {
  get(monthKey: string): AiAnalysisResult | null;
  set(result: AiAnalysisResult): void;
  invalidate(monthKey: string): void;
  clear(): void;
}

class StorageManagerAnalysisCacheService implements AnalysisCacheService {
  get(monthKey: string): AiAnalysisResult | null {
    return StorageManager.getCachedAnalysis(monthKey);
  }
  set(result: AiAnalysisResult): void {
    StorageManager.cacheAnalysis(result);
  }
  invalidate(monthKey: string): void {
    StorageManager.invalidateAnalysis(monthKey);
  }
  clear(): void {
    StorageManager.clearAnalysisCache();
  }
}

export const analysisCacheService: AnalysisCacheService =
  new StorageManagerAnalysisCacheService();
