export interface Expense {
  id: number;
  amount: number;
  description: string;
  category: string;
  date: number; // timestamp in millis
  note?: string | null;
  createdAt: number;
}

export type ExpenseAttachmentKind = 'purchase' | 'receipt' | 'proof';

export interface ExpenseAttachment {
  id: string;
  expenseId: number;
  storageKey: string;
  mimeType: string;
  createdAt: number;
  originalFilename?: string | null;
  kind: ExpenseAttachmentKind;
  byteSize: number;
  width: number;
  height: number;
}

export interface MonthlyBudget {
  monthKey: string; // Format: "yyyy-MM", e.g. "2026-09"
  startingAmount: number;
  updatedAt: number;
}

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
export type Language = 'en' | 'fr' | 'ar';

export interface LockTimeoutOption {
  seconds: number;
  label: string;
}

export interface CategoryInfo {
  name: string;
  iconEmoji: string;
  color: string; // hex code
  bgColor: string; // Tailwind background or rgba
}

export interface CategorySpend {
  categoryName: string;
  amount: number;
  percentage: number; // 0 to 100
  iconEmoji: string;
  color: string;
}

export type InsightType = 'INFO' | 'WARNING' | 'TIP' | 'SUCCESS';

export interface SpendingInsight {
  title: string;
  message: string;
  type: InsightType;
}

export type InsightSeverity = 'INFO' | 'NOTABLE' | 'REVIEW' | 'POSITIVE';

export interface InsightCardItem {
  title: string;
  explanation: string;
  numbers: string;
  category?: string | null;
  severity: InsightSeverity;
}

export interface AiAnalysisResult {
  timestamp: number;
  analyzedMonthKey: string;
  isAiGenerated: boolean;
  spendingOverview: string;
  historyContext: string;
  biggestChanges: InsightCardItem[];
  unusualExpenses: InsightCardItem[];
  recurringSpending: InsightCardItem[];
  areasToReview: InsightCardItem[];
}

export type SmartCaptureConfidence = 'high' | 'medium' | 'low';

export interface SmartCaptureResult {
  description?: string | null;
  category: string;
  amount?: number | null;
  merchantOrBrand?: string | null;
  notes?: string | null;
  confidence: SmartCaptureConfidence;
  uncertaintyReason?: string | null;
  priceVisible: boolean;
  detectedCurrencyCode?: string | null;
  currencyMismatch: boolean;
}

export interface ReceiptScanResult {
  merchant?: string | null;
  totalAmount?: number | null;
  dateMillis?: number | null;
  dateFormatted?: string | null;
  category?: string | null;
  items: string[];
  notesSummary?: string | null;
  detectedCurrencyCode?: string | null;
  currencyMismatch: boolean;
  isUncertain: boolean;
  uncertaintyReason?: string | null;
}

export interface BackupMetadata {
  appVersion: string;
  schemaVersion: number;
  exportedAt: number;
  exportedAtFormatted: string;
  totalExpenses: number;
  totalBudgets: number;
}

export interface BackupSettings {
  currencyCode: string;
  themeMode: ThemeMode;
  language: Language;
}

export interface ExpenseBackupItem {
  id: number;
  amount: number;
  description: string;
  category: string;
  date: number;
  dateFormatted: string;
  note?: string | null;
  createdAt: number;
}

export interface MonthlyBudgetBackupItem {
  monthKey: string;
  startingAmount: number;
  updatedAt: number;
}

export interface SpendWiseBackup {
  metadata: BackupMetadata;
  settings: BackupSettings;
  monthlyBudgets: MonthlyBudgetBackupItem[];
  expenses: ExpenseBackupItem[];
}

export interface ImportSummary {
  expensesImported: number;
  budgetsImported: number;
  currencyUpdated?: string | null;
  wasReplaced: boolean;
}

export interface MediaStorageSummary {
  photoCount: number;
  totalBytes: number;
  purchaseCount: number;
  receiptCount: number;
  proofCount: number;
  integrityIssueCount: number;
}

export interface CategoryBaseline {
  category: string;
  historicalMonthlyAverage: number;
  typicalTransactionMedian: number;
  typicalTransactionMean: number;
  monthlyTransactionFrequency: number;
  currentMonthTotal: number;
  previousMonthTotal: number;
  currentMonthCount: number;
}

export interface RecurringCandidate {
  descriptionGroup: string;
  category: string;
  countThisMonth: number;
  totalAmountThisMonth: number;
  averageAmount: number;
}

export interface HistoricalSpendingSummary {
  totalMonthsRecorded: number;
  historicalMonthlyAverage: number;
  currentMonthKey: string;
  currentMonthTotal: number;
  previousMonthKey?: string | null;
  previousMonthTotal?: number | null;
  categoryBaselines: CategoryBaseline[];
  currentMonthExpenses: Expense[];
  recurringCandidates: RecurringCandidate[];
}

export type Screen = 'home' | 'history' | 'insights' | 'statistics' | 'settings';
export type PrimaryScreen = Exclude<Screen, 'settings'>;

export type TimePeriod = 'CURRENT_MONTH' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS' | 'ALL_TIME';

export interface MonthlySpendingStat {
  monthKey: string;
  monthDisplayName: string;
  totalSpent: number;
  startingBudget: number;
  isBudgetSet: boolean;
  remainingMoney: number;
  transactionCount: number;
  isPartialMonth: boolean;
  largestExpense: Expense | null;
}

export interface CategoryTrendMonth {
  monthKey: string;
  monthDisplayName: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CategoryTrend {
  category: string;
  totalSpent: number;
  percentageOfPeriod: number;
  monthlyData: CategoryTrendMonth[];
  trendDirection: 'UP' | 'DOWN' | 'STABLE';
  trendPercent: number; // change from first month to last month in period
}

export interface StatisticsOverview {
  period: TimePeriod;
  periodLabel: string;
  totalSpent: number;
  totalBudget: number;
  totalRemaining: number;
  totalTransactions: number;
  averageTransactionAmount: number;
  overallLargestExpense: Expense | null;
  monthlyStats: MonthlySpendingStat[];
  categoryTrends: CategoryTrend[];
  categoryPercentages: {
    category: string;
    amount: number;
    percentage: number;
    color: string;
    iconEmoji: string;
  }[];
  averageTransactionsPerMonth: number;
}

export interface AiTrendExplanationResult {
  timestamp: number;
  periodLabel: string;
  summary: string;
  keyObservations: string[];
  categoryHighlights: string[];
  recommendation: string;
}
