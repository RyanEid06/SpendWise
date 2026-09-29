import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FX_SNAPSHOT_DATE,
  LBP_RATE,
  SUPPORTED_CURRENCIES,
  getSuggestedConversionRate,
} from '../src/utils/currency';

test('WP12B FX defaults are dated and preserve the chosen LBP reference', () => {
  assert.equal(DEFAULT_FX_SNAPSHOT_DATE, '2026-09-29');
  assert.equal(getSuggestedConversionRate('USD', 'LBP'), LBP_RATE);
  assert.ok(Math.abs((getSuggestedConversionRate('LBP', 'USD') ?? 0) - 1 / LBP_RATE) < 1e-12);
});

test('every supported currency pair gets a finite positive default', () => {
  for (const source of SUPPORTED_CURRENCIES) {
    for (const target of SUPPORTED_CURRENCIES) {
      const rate = getSuggestedConversionRate(source.code, target.code);
      assert.notEqual(rate, null, `${source.code}->${target.code} should have a default`);
      assert.ok(Number.isFinite(rate), `${source.code}->${target.code} should be finite`);
      assert.ok((rate ?? 0) > 0, `${source.code}->${target.code} should be positive`);
    }
  }
});

test('cross-currency defaults are reciprocal within snapshot rounding', () => {
  for (const source of SUPPORTED_CURRENCIES) {
    for (const target of SUPPORTED_CURRENCIES) {
      const forward = getSuggestedConversionRate(source.code, target.code);
      const reverse = getSuggestedConversionRate(target.code, source.code);
      assert.ok(forward != null && reverse != null);
      assert.ok(Math.abs(forward * reverse - 1) < 1e-9, `${source.code}<->${target.code} should be reciprocal`);
    }
  }
});

test('unknown currencies do not invent a default', () => {
  assert.equal(getSuggestedConversionRate('USD', 'XYZ'), null);
  assert.equal(getSuggestedConversionRate('XYZ', 'EUR'), null);
});
