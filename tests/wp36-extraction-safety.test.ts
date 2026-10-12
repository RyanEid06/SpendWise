import test from 'node:test';
import assert from 'node:assert/strict';
import { smartCaptureRouter } from '../server/routes/smartCapture';
import { receiptScanRouter } from '../server/routes/receiptScan';
import { geminiService } from '../server/services/GeminiService';
import { matchesGeminiSchema } from '../server/validation/geminiSchema';
import { createAiFailure } from '../server/geminiReliability';

async function invoke(router: any, value: unknown) {
  const original = geminiService.generateJson;
  geminiService.generateJson = async request => {
    if (!matchesGeminiSchema(value, request.responseJsonSchema)) throw createAiFailure('AI_INVALID_RESPONSE');
    const result = request.validate(value);
    if (result == null) throw createAiFailure('AI_INVALID_RESPONSE');
    return result;
  };
  let status = 200; let payload: any;
  const res: any = { locals: {}, status(s: number) { status = s; return this; }, json(v: any) { payload = v; return this; } };
  try {
    await router.stack[0].route.stack[0].handle({ body: { imageBase64: 'aGVsbG8=', mimeType: 'image/png', currencyCode: 'USD', language: 'en' } }, res);
    return { status, payload };
  } finally { geminiService.generateJson = original; }
}
const smart = { description: null, category: 'Other', amount: null, merchantOrBrand: null, notes: null,
  confidence: 'low', uncertaintyReason: 'Unreadable synthetic image', priceVisible: false, detectedCurrencyCode: null };
const receipt = { merchant: null, totalAmount: null, totalKind: 'unknown', totalIsReliable: false, detectedCurrencyCode: null,
  multipleCurrencies: false, date: null, category: 'Other', items: [], uncertaintyReason: 'Unreadable synthetic image' };

test('unreadable images preserve absent extraction fields and never invent an amount or date', async () => {
  const captured = await invoke(smartCaptureRouter, smart);
  assert.equal(captured.status, 200); assert.equal(captured.payload.amount, null); assert.equal(captured.payload.description, null);
  const scanned = await invoke(receiptScanRouter, receipt);
  assert.equal(scanned.status, 200); assert.equal(scanned.payload.totalAmount, null); assert.equal(scanned.payload.dateMillis, null);
  assert.equal(scanned.payload.isUncertain, true);
});

test('ambiguous/mismatched image amounts are not authoritative draft values', async () => {
  for (const patch of [{ priceVisible: false }, { detectedCurrencyCode: null }, { detectedCurrencyCode: 'EUR' }]) {
    const result = await invoke(smartCaptureRouter, { ...smart, amount: 12.5, priceVisible: true, detectedCurrencyCode: 'USD', ...patch });
    assert.equal(result.payload.amount, null);
  }
  for (const patch of [{ totalIsReliable: false }, { totalKind: 'subtotal' }, { multipleCurrencies: true }, { detectedCurrencyCode: 'EUR' }]) {
    const result = await invoke(receiptScanRouter, { ...receipt, totalAmount: 12.5, totalKind: 'total', totalIsReliable: true, detectedCurrencyCode: 'USD', ...patch });
    assert.equal(result.payload.totalAmount, null); assert.equal(result.payload.isUncertain, true);
  }
});

test('missing required structured extraction fields and wrong types fail instead of fabricating a draft', async () => {
  for (const [router, value] of [[smartCaptureRouter, smart], [receiptScanRouter, receipt]] as const) {
    assert.equal((await invoke(router, {})).status, 502);
    assert.equal((await invoke(router, { ...value, category: 'Invented' })).payload.error, 'AI_INVALID_RESPONSE');
  }
  assert.equal((await invoke(smartCaptureRouter, { ...smart, amount: '12.5' })).status, 502);
  assert.equal((await invoke(receiptScanRouter, { ...receipt, totalAmount: '12.5' })).status, 502);
});

test('receipt invalid/future dates remain correctable and reliable totals stay unchanged', async () => {
  for (const date of ['2026-02-31', '2999-01-01', null]) {
    const result = await invoke(receiptScanRouter, { ...receipt, merchant: 'Synthetic', totalAmount: 12.5, totalKind: 'total',
      totalIsReliable: true, detectedCurrencyCode: 'USD', date, uncertaintyReason: null });
    assert.equal(result.payload.totalAmount, 12.5); assert.equal(result.payload.dateMillis, null); assert.equal(result.payload.isUncertain, true);
  }
});
