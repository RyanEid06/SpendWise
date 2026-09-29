export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  symbolPrefix?: boolean;
}

export const LBP_RATE = 90000; // User-selected default: 1 USD = 90,000 LBP
export const DEFAULT_FX_SNAPSHOT_DATE = '2026-09-29';

// Snapshot defaults: target currency units per 1 USD. These are deliberately
// static suggestions for the conversion dialog, not a live FX feed.
export const USD_BASED_DEFAULT_RATES: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  LBP: LBP_RATE,
  EUR: 0.8790,
  GBP: 0.7552,
  AED: 3.6730,
  SAR: 3.7542,
  EGP: 52.15,
  CAD: 1.4174,
  AUD: 1.4251,
  JPY: 157.32,
  INR: 95.98,
});

export const MAX_CURRENCY_RATE = 1e12;
export const MAX_STORED_AMOUNT = 1e15;

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)', symbolPrefix: true },
  { code: 'LBP', symbol: 'L.L.', name: 'Lebanese Lira (LBP)', symbolPrefix: false },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)', symbolPrefix: true },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', symbolPrefix: true },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham (AED)', symbolPrefix: false },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal (SAR)', symbolPrefix: false },
  { code: 'EGP', symbol: 'ج.م', name: 'Egyptian Pound (EGP)', symbolPrefix: false },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD)', symbolPrefix: true },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AUD)', symbolPrefix: true },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)', symbolPrefix: true },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)', symbolPrefix: true },
];

export const DEFAULT_CURRENCY_CODE = 'USD';

export function getCurrency(code: string): CurrencyOption {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code.toLowerCase() === code.toLowerCase()) ||
    SUPPORTED_CURRENCIES[0]
  );
}

export function isValidConversionRate(targetUnitsPerSourceUnit: number): boolean {
  return (
    Number.isFinite(targetUnitsPerSourceUnit) &&
    targetUnitsPerSourceUnit > 0 &&
    targetUnitsPerSourceUnit <= MAX_CURRENCY_RATE
  );
}

// Authoritative convention: target currency units per 1 source currency unit.
export function convertCurrencyAmount(
  amount: number,
  targetUnitsPerSourceUnit: number
): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Amount must be a finite non-negative number.');
  }
  if (!isValidConversionRate(targetUnitsPerSourceUnit)) {
    throw new Error('Conversion rate must be a finite positive number.');
  }

  const converted = amount * targetUnitsPerSourceUnit;
  if (
    !Number.isFinite(converted) ||
    Math.abs(converted) > MAX_STORED_AMOUNT ||
    (amount > 0 && converted <= 0)
  ) {
    throw new Error('Converted amount is outside the supported numeric range.');
  }

  // Keep useful floating-point precision without applying display rounding to storage.
  return Number(converted.toPrecision(15));
}

export function getSuggestedConversionRate(sourceCode: string, targetCode: string): number | null {
  const source = sourceCode.toUpperCase();
  const target = targetCode.toUpperCase();

  if (source === target) return 1;

  const sourcePerUsd = USD_BASED_DEFAULT_RATES[source];
  const targetPerUsd = USD_BASED_DEFAULT_RATES[target];
  if (!sourcePerUsd || !targetPerUsd) return null;

  const crossRate = targetPerUsd / sourcePerUsd;
  return Number(crossRate.toPrecision(12));
}

export function convertUsdToLbp(usd: number): number {
  return convertCurrencyAmount(usd, LBP_RATE);
}

export function convertLbpToUsd(lbp: number): number {
  return convertCurrencyAmount(lbp, 1 / LBP_RATE);
}

export function formatCurrency(
  amount: number,
  currencyCode: string = DEFAULT_CURRENCY_CODE
): string {
  const currency = getCurrency(currencyCode);
  const decimals = (currency.code === 'JPY' || currency.code === 'LBP') ? 0 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return currency.symbolPrefix !== false
    ? `${currency.symbol}${formatted}`
    : `${formatted} ${currency.symbol}`;
}