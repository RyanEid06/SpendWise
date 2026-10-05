import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, getCurrency, SUPPORTED_CURRENCIES } from '../src/utils/currency';
import { formatHistoryDate, formatHistoryTime, formatHistoryGroupLabel, localeForLanguage } from '../src/utils/historyView';
import type { Language } from '../src/types';

test('currency formatter reuse preserves every supported symbol and numeric rounding rule', () => {
  for (const code of [...SUPPORTED_CURRENCIES.map((item) => item.code), 'usd', 'unknown']) {
    const currency = getCurrency(code); const decimals = currency.code === 'JPY' || currency.code === 'LBP' ? 0 : 2;
    for (const amount of [0, -0, 0.005, 1.005, 12.345, -12.345, 12345678.12345, Infinity, NaN]) {
      const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
      const expected = currency.symbolPrefix !== false ? currency.symbol + number : number + ' ' + currency.symbol;
      assert.equal(formatCurrency(amount, code), expected);
    }
  }
});
test('History formatter reuse preserves EN/FR/AR across timezone changes, DST and year boundaries', () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/New_York', 'Asia/Beirut', 'America/Bogota', 'UTC']) {
      process.env.TZ = timezone;
      for (const language of ['en', 'fr', 'ar'] as Language[]) for (const timestamp of [0, Date.UTC(2026, 0, 1), Date.UTC(2026, 2, 8, 6, 59), Date.UTC(2026, 2, 8, 7, 1), Date.UTC(2026, 6, 5, 23, 59), Date.UTC(2026, 10, 1, 5, 59), Date.UTC(2026, 10, 1, 6, 1)]) {
        const locale = localeForLanguage(language); const date = new Date(timestamp);
        assert.equal(formatHistoryDate(timestamp, language), new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date));
        assert.equal(formatHistoryTime(timestamp, language), new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date));
        const now = Date.UTC(2027, 6, 6, 12);
        assert.equal(formatHistoryGroupLabel(timestamp, language, now), new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' }).format(date));
      }
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('large-ledger formatting uses bounded reusable formatters instead of one constructor per row', () => {
  const NumberFormat = Intl.NumberFormat; const DateTimeFormat = Intl.DateTimeFormat;
  let numberConstructors = 0; let dateConstructors = 0;
  try {
    Intl.NumberFormat = function (...args: ConstructorParameters<typeof NumberFormat>) { numberConstructors++; return new NumberFormat(...args); } as typeof NumberFormat;
    Intl.DateTimeFormat = function (...args: ConstructorParameters<typeof DateTimeFormat>) { dateConstructors++; return new DateTimeFormat(...args); } as typeof DateTimeFormat;
    for (let index = 0; index < 10000; index++) {
      const language = (['en', 'fr', 'ar'] as const)[index % 3]; const timestamp = Date.UTC(2026, index % 12, index % 28 + 1, index % 24);
      formatCurrency(index / 100, index % 2 ? 'USD' : 'JPY'); formatHistoryDate(timestamp, language); formatHistoryTime(timestamp, language); formatHistoryGroupLabel(timestamp, language, Date.UTC(2027, 0, 1));
    }
    assert.ok(numberConstructors <= 2); assert.ok(dateConstructors <= 9);
  } finally { Intl.NumberFormat = NumberFormat; Intl.DateTimeFormat = DateTimeFormat; }
});
