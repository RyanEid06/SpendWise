export const allowedSeverities = new Set(['INFO', 'NOTABLE', 'REVIEW', 'POSITIVE']);
export const allowedCategories = new Set([
  'Food',
  'Groceries',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills',
  'Subscriptions',
  'Health',
  'Education',
  'Electronics',
  'Travel',
  'Other',
]);
export const allowedCurrencies = new Set([
  'USD',
  'LBP',
  'EUR',
  'GBP',
  'AED',
  'SAR',
  'EGP',
  'CAD',
  'AUD',
  'JPY',
  'INR',
]);
export const allowedLanguages = new Set(['en', 'fr', 'ar']);

export const spendingResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['spendingOverview', 'historyContext', 'biggestChanges', 'unusualExpenses', 'recurringSpending', 'areasToReview'],
  properties: {
    spendingOverview: { type: 'string' },
    historyContext: { type: 'string' },
    biggestChanges: { type: 'array', items: { type: 'object' } },
    unusualExpenses: { type: 'array', items: { type: 'object' } },
    recurringSpending: { type: 'array', items: { type: 'object' } },
    areasToReview: { type: 'array', items: { type: 'object' } },
  },
} as const;

export const trendResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'keyObservations', 'categoryHighlights', 'recommendation'],
  properties: {
    summary: { type: 'string' },
    keyObservations: { type: 'array', items: { type: 'string' } },
    categoryHighlights: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
  },
} as const;

export const smartCaptureResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['description', 'category', 'amount', 'merchantOrBrand', 'notes', 'confidence', 'uncertaintyReason', 'priceVisible', 'detectedCurrencyCode'],
  properties: {
    description: { type: ['string', 'null'] },
    category: { type: 'string', enum: Array.from(allowedCategories) },
    amount: { type: ['number', 'null'] },
    merchantOrBrand: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    uncertaintyReason: { type: ['string', 'null'] },
    priceVisible: { type: 'boolean' },
    detectedCurrencyCode: { type: ['string', 'null'] },
  },
} as const;

export const receiptResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['merchant', 'totalAmount', 'totalKind', 'totalIsReliable', 'detectedCurrencyCode', 'multipleCurrencies', 'date', 'category', 'items', 'uncertaintyReason'],
  properties: {
    merchant: { type: ['string', 'null'] },
    totalAmount: { type: ['number', 'null'] },
    totalKind: { type: 'string', enum: ['total', 'amount_due', 'paid', 'subtotal', 'tax', 'item', 'unknown'] },
    totalIsReliable: { type: 'boolean' },
    detectedCurrencyCode: { type: ['string', 'null'] },
    multipleCurrencies: { type: 'boolean' },
    date: { type: ['string', 'null'] },
    category: { type: 'string', enum: Array.from(allowedCategories) },
    items: { type: 'array', items: { type: 'string' } },
    uncertaintyReason: { type: ['string', 'null'] },
  },
} as const;

export type SupportedLanguage = 'en' | 'fr' | 'ar';

export type PlainObject = Record<string, unknown>;

export function asObject(value: unknown): PlainObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PlainObject)
    : null;
}

export function safeString(value: unknown, max = 4000, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

export function requiredString(value: unknown, max: number): string | null {
  const text = safeString(value, max).trim();
  return text ? text : null;
}

export function finiteNumber(
  value: unknown,
  options: { min?: number; max?: number } = {}
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (options.min != null && value < options.min) return null;
  if (options.max != null && value > options.max) return null;
  return value;
}

export function finiteInteger(
  value: unknown,
  options: { min?: number; max?: number } = {}
): number | null {
  if (!Number.isInteger(value)) return null;
  const numberValue = value as number;
  if (options.min != null && numberValue < options.min) return null;
  if (options.max != null && numberValue > options.max) return null;
  return numberValue;
}

export function optionalFiniteNumber(
  value: unknown,
  options: { min?: number; max?: number } = {}
): number | null {
  if (value == null) return null;
  return finiteNumber(value, options);
}

export function safeLanguage(value: unknown): SupportedLanguage | null {
  return typeof value === 'string' && allowedLanguages.has(value)
    ? (value as SupportedLanguage)
    : null;
}

export function safeCurrency(value: unknown): string | null {
  return typeof value === 'string' && allowedCurrencies.has(value) ? value : null;
}

export function safeDetectedCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function safeInsightArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).flatMap((item) => {
    const obj = asObject(item);
    if (!obj) return [];

    const title = requiredString(obj.title, 240);
    const explanation = requiredString(obj.explanation, 1000);
    if (!title || !explanation) return [];

    const severity = allowedSeverities.has(String(obj.severity))
      ? String(obj.severity)
      : 'INFO';

    return [
      {
        title,
        explanation,
        numbers: safeString(obj.numbers, 240),
        category:
          typeof obj.category === 'string' ? obj.category.slice(0, 80) : null,
        severity,
      },
    ];
  });
}

export function capSpendingInsightGroups(groups: {
  biggestChanges: ReturnType<typeof safeInsightArray>;
  unusualExpenses: ReturnType<typeof safeInsightArray>;
  recurringSpending: ReturnType<typeof safeInsightArray>;
  areasToReview: ReturnType<typeof safeInsightArray>;
}) {
  let remaining = 3;
  const take = <T>(items: T[]) => {
    const selected = items.slice(0, remaining);
    remaining -= selected.length;
    return selected;
  };

  // Review/action items first, then measured changes and recurring patterns.
  // Unusual single purchases come last because unusual does not automatically mean harmful.
  const areasToReview = take(groups.areasToReview);
  const biggestChanges = take(groups.biggestChanges);
  const recurringSpending = take(groups.recurringSpending);
  const unusualExpenses = take(groups.unusualExpenses);

  return { biggestChanges, unusualExpenses, recurringSpending, areasToReview };
}


export function sanitizeExpense(value: unknown) {
  const obj = asObject(value);
  if (!obj) return null;

  const amount = finiteNumber(obj.amount, { min: 0.000001, max: 1_000_000_000_000 });
  const description = requiredString(obj.description, 240);
  const category = requiredString(obj.category, 80);
  const date = finiteNumber(obj.date, { min: 1, max: 9_000_000_000_000_000 });

  if (amount == null || !description || !category || date == null) return null;

  return {
    amount,
    description,
    category,
    date,
    note: typeof obj.note === 'string' ? obj.note.slice(0, 1000) : null,
  };
}

export function sanitizeHistoricalSummary(value: unknown) {
  const obj = asObject(value);
  if (!obj) return null;

  const totalMonthsRecorded = finiteInteger(obj.totalMonthsRecorded, {
    min: 0,
    max: 1200,
  });
  const historicalMonthlyAverage = finiteNumber(obj.historicalMonthlyAverage, {
    min: 0,
    max: 1_000_000_000_000,
  });
  const currentMonthKey =
    typeof obj.currentMonthKey === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(obj.currentMonthKey)
      ? obj.currentMonthKey
      : null;
  const currentMonthTotal = finiteNumber(obj.currentMonthTotal, {
    min: 0,
    max: 1_000_000_000_000,
  });
  const previousMonthTotal = optionalFiniteNumber(obj.previousMonthTotal, {
    min: 0,
    max: 1_000_000_000_000,
  });

  if (
    totalMonthsRecorded == null ||
    historicalMonthlyAverage == null ||
    !currentMonthKey ||
    currentMonthTotal == null
  ) {
    return null;
  }

  const categoryBaselines = Array.isArray(obj.categoryBaselines)
    ? obj.categoryBaselines.slice(0, 40).flatMap((entry) => {
        const item = asObject(entry);
        if (!item) return [];

        const category = requiredString(item.category, 80);
        const historicalMonthlyAverage = finiteNumber(item.historicalMonthlyAverage, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const typicalTransactionMedian = finiteNumber(item.typicalTransactionMedian, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const typicalTransactionMean = finiteNumber(item.typicalTransactionMean, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const monthlyTransactionFrequency = finiteNumber(item.monthlyTransactionFrequency, {
          min: 0,
          max: 100_000,
        });
        const currentMonthTotal = finiteNumber(item.currentMonthTotal, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const previousMonthTotal = finiteNumber(item.previousMonthTotal, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const currentMonthCount = finiteInteger(item.currentMonthCount, {
          min: 0,
          max: 100_000,
        });

        if (
          !category ||
          historicalMonthlyAverage == null ||
          typicalTransactionMedian == null ||
          typicalTransactionMean == null ||
          monthlyTransactionFrequency == null ||
          currentMonthTotal == null ||
          previousMonthTotal == null ||
          currentMonthCount == null
        ) {
          return [];
        }

        return [
          {
            category,
            historicalMonthlyAverage,
            typicalTransactionMedian,
            typicalTransactionMean,
            monthlyTransactionFrequency,
            currentMonthTotal,
            previousMonthTotal,
            currentMonthCount,
          },
        ];
      })
    : [];

  const currentMonthExpenses = Array.isArray(obj.currentMonthExpenses)
    ? obj.currentMonthExpenses
        .slice(0, 250)
        .map(sanitizeExpense)
        .filter((item): item is NonNullable<ReturnType<typeof sanitizeExpense>> => item !== null)
    : [];

  const recurringCandidates = Array.isArray(obj.recurringCandidates)
    ? obj.recurringCandidates.slice(0, 60).flatMap((entry) => {
        const item = asObject(entry);
        if (!item) return [];

        const descriptionGroup = requiredString(item.descriptionGroup, 240);
        const category = requiredString(item.category, 80);
        const countThisMonth = finiteInteger(item.countThisMonth, {
          min: 2,
          max: 100_000,
        });
        const totalAmountThisMonth = finiteNumber(item.totalAmountThisMonth, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const averageAmount = finiteNumber(item.averageAmount, {
          min: 0,
          max: 1_000_000_000_000,
        });

        if (
          !descriptionGroup ||
          !category ||
          countThisMonth == null ||
          totalAmountThisMonth == null ||
          averageAmount == null
        ) {
          return [];
        }

        return [
          {
            descriptionGroup,
            category,
            countThisMonth,
            totalAmountThisMonth,
            averageAmount,
          },
        ];
      })
    : [];

  return {
    totalMonthsRecorded,
    historicalMonthlyAverage,
    currentMonthKey,
    currentMonthTotal,
    previousMonthTotal,
    categoryBaselines,
    currentMonthExpenses,
    recurringCandidates,
  };
}

export function sanitizeStatistics(value: unknown) {
  const obj = asObject(value);
  if (!obj) return null;

  const periodLabel = requiredString(obj.periodLabel, 100);
  const totalSpent = finiteNumber(obj.totalSpent, {
    min: 0,
    max: 1_000_000_000_000,
  });
  const totalTransactions = finiteInteger(obj.totalTransactions, {
    min: 0,
    max: 10_000_000,
  });
  const averageTransactionAmount = finiteNumber(obj.averageTransactionAmount, {
    min: 0,
    max: 1_000_000_000_000,
  });

  if (
    !periodLabel ||
    totalSpent == null ||
    totalTransactions == null ||
    averageTransactionAmount == null
  ) {
    return null;
  }

  const overallLargestExpense = sanitizeExpense(obj.overallLargestExpense);

  const monthlyStats = Array.isArray(obj.monthlyStats)
    ? obj.monthlyStats.slice(0, 120).flatMap((entry) => {
        const item = asObject(entry);
        if (!item) return [];

        const monthKey =
          typeof item.monthKey === 'string' &&
          /^\d{4}-(0[1-9]|1[0-2])$/.test(item.monthKey)
            ? item.monthKey
            : null;
        const totalSpent = finiteNumber(item.totalSpent, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const transactionCount = finiteInteger(item.transactionCount, {
          min: 0,
          max: 10_000_000,
        });
        const startingBudget = finiteNumber(item.startingBudget, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const remainingMoney = finiteNumber(item.remainingMoney, {
          min: -1_000_000_000_000,
          max: 1_000_000_000_000,
        });

        if (
          !monthKey ||
          totalSpent == null ||
          transactionCount == null ||
          startingBudget == null ||
          remainingMoney == null
        ) {
          return [];
        }

        return [
          {
            monthKey,
            totalSpent,
            transactionCount,
            startingBudget,
            remainingMoney,
            isBudgetSet: item.isBudgetSet === true,
            largestExpense: sanitizeExpense(item.largestExpense),
          },
        ];
      })
    : [];

  const categoryTrends = Array.isArray(obj.categoryTrends)
    ? obj.categoryTrends.slice(0, 40).flatMap((entry) => {
        const item = asObject(entry);
        if (!item) return [];

        const category = requiredString(item.category, 80);
        const totalSpent = finiteNumber(item.totalSpent, {
          min: 0,
          max: 1_000_000_000_000,
        });
        const percentageOfPeriod = finiteNumber(item.percentageOfPeriod, {
          min: 0,
          max: 100,
        });
        const trendPercent = finiteNumber(item.trendPercent, {
          min: -1_000_000,
          max: 1_000_000,
        });
        const trendDirection =
          item.trendDirection === 'UP' ||
          item.trendDirection === 'DOWN' ||
          item.trendDirection === 'STABLE'
            ? item.trendDirection
            : 'STABLE';

        if (
          !category ||
          totalSpent == null ||
          percentageOfPeriod == null ||
          trendPercent == null
        ) {
          return [];
        }

        const monthlyData = Array.isArray(item.monthlyData)
          ? item.monthlyData.slice(0, 120).flatMap((monthEntry) => {
              const month = asObject(monthEntry);
              if (!month) return [];

              const monthKey =
                typeof month.monthKey === 'string' &&
                /^\d{4}-(0[1-9]|1[0-2])$/.test(month.monthKey)
                  ? month.monthKey
                  : null;
              const amount = finiteNumber(month.amount, {
                min: 0,
                max: 1_000_000_000_000,
              });
              const count = finiteInteger(month.count, {
                min: 0,
                max: 10_000_000,
              });

              if (!monthKey || amount == null || count == null) return [];

              return [{ monthKey, amount, count }];
            })
          : [];

        return [
          {
            category,
            totalSpent,
            percentageOfPeriod,
            trendDirection,
            trendPercent,
            monthlyData,
          },
        ];
      })
    : [];

  return {
    periodLabel,
    totalSpent,
    totalTransactions,
    averageTransactionAmount,
    overallLargestExpense,
    monthlyStats,
    categoryTrends,
  };
}

export function sanitizeSmartCaptureResponse(
  value: unknown,
  currentCurrencyCode: string
) {
  const obj = asObject(value);
  if (!obj) return null;

  const description =
    typeof obj.description === 'string' ? obj.description.slice(0, 240).trim() || null : null;
  const merchantOrBrand =
    typeof obj.merchantOrBrand === 'string'
      ? obj.merchantOrBrand.slice(0, 200).trim() || null
      : null;
  const notes =
    typeof obj.notes === 'string' ? obj.notes.slice(0, 1000).trim() || null : null;
  const uncertaintyReason =
    typeof obj.uncertaintyReason === 'string'
      ? obj.uncertaintyReason.slice(0, 1000).trim() || null
      : null;

  const category =
    typeof obj.category === 'string' && allowedCategories.has(obj.category)
      ? obj.category
      : 'Other';

  const confidence =
    obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low'
      ? obj.confidence
      : 'low';

  const priceVisible = obj.priceVisible === true;
  const detectedCurrencyCode = safeDetectedCurrency(obj.detectedCurrencyCode);
  const currencyMismatch =
    detectedCurrencyCode != null && detectedCurrencyCode !== currentCurrencyCode;

  const candidateAmount = finiteNumber(obj.amount, {
    min: 0.000001,
    max: 1_000_000_000_000,
  });

  // Amount is authoritative only when the image itself supports it and
  // the visible currency matches the user's selected SpendWise currency.
  const amount =
    priceVisible &&
    detectedCurrencyCode === currentCurrencyCode &&
    !currencyMismatch &&
    candidateAmount != null
      ? candidateAmount
      : null;

  return {
    description,
    category,
    amount,
    merchantOrBrand,
    notes,
    confidence,
    uncertaintyReason:
      currencyMismatch
        ? uncertaintyReason || 'Visible price appears to use a different currency.'
        : uncertaintyReason,
    priceVisible,
    detectedCurrencyCode,
    currencyMismatch,
  };
}
