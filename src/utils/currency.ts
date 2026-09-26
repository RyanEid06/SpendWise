export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  symbolPrefix?: boolean;
}

export const LBP_RATE = 90000; // $1 = 90,000 L.L.

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)', symbolPrefix: true },
  { code: 'LBP', symbol: 'L.L.', name: 'Lebanese Lira (LBP) - $1 = 90,000 L.L.', symbolPrefix: false },
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

export function convertUsdToLbp(usd: number): number {
  return usd * LBP_RATE;
}

export function convertLbpToUsd(lbp: number): number {
  return lbp / LBP_RATE;
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
