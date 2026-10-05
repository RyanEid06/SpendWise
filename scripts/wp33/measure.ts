import { performance } from 'node:perf_hooks';

export interface OperationMeasurement {
  operation: string;
  samplesMs: number[];
  medianMs: number;
  minMs: number;
  maxMs: number;
  madMs: number;
  validatedSamples: number;
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function summarizeSamples(samplesMs: number[]) {
  if (!samplesMs.length || samplesMs.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('INVALID_BENCHMARK_SAMPLES');
  const medianMs = median(samplesMs);
  return { medianMs, minMs: Math.min(...samplesMs), maxMs: Math.max(...samplesMs), madMs: median(samplesMs.map((value) => Math.abs(value - medianMs))) };
}
export async function measureOperation<T>(operation: string, work: () => T | Promise<T>, validate: (value: T) => void, samples = 5, warmups = 1): Promise<OperationMeasurement> {
  if (!Number.isInteger(samples) || samples < 1 || samples > 20 || !Number.isInteger(warmups) || warmups < 0 || warmups > 5) throw new Error('INVALID_BENCHMARK_CONFIGURATION');
  for (let i = 0; i < warmups; i++) validate(await work());
  const samplesMs: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now(); const value = await work(); const elapsed = performance.now() - start;
    validate(value); samplesMs.push(elapsed);
  }
  return { operation, samplesMs, ...summarizeSamples(samplesMs), validatedSamples: samples };
}
