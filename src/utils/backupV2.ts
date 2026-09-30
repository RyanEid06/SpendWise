import JSZip from 'jszip';
import type {
  BackupSettings,
  Expense,
  ExpenseAttachment,
  ExpenseBackupItem,
  MonthlyBudget,
  MonthlyBudgetBackupItem,
} from '../types';
import type { FinancialState } from './financialState';
import { validateFinancialState } from './financialState';
import { formatDate } from './date';

export const BACKUP_V2_FORMAT = 'spendwise-backup-v2';
export const BACKUP_V2_SCHEMA_VERSION = 2;
export const BACKUP_V2_MANIFEST_PATH = 'manifest.json';
export const MAX_BACKUP_V2_ARCHIVE_BYTES = 512 * 1024 * 1024;
export const MAX_BACKUP_V2_ENTRIES = 10_000;
export const MAX_BACKUP_V2_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_BACKUP_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_BACKUP_MEDIA_BYTES = 5 * 1024 * 1024;

export interface BackupV2AttachmentRecord {
  id: string;
  expenseId: number;
  storageKey: string;
  mimeType: string;
  createdAt: number;
  originalFilename?: string | null;
  kind: ExpenseAttachment['kind'];
  byteSize: number;
  width: number;
  height: number;
  mediaEntry: string | null;
  checksumSha256: string | null;
}

export interface BackupV2Manifest {
  format: typeof BACKUP_V2_FORMAT;
  backupSchemaVersion: typeof BACKUP_V2_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: number;
  exportedAtFormatted: string;
  mediaIncluded: boolean;
  counts: {
    expenses: number;
    budgets: number;
    attachments: number;
    mediaFiles: number;
    mediaBytes: number;
  };
  settings: BackupSettings;
  expenses: ExpenseBackupItem[];
  monthlyBudgets: MonthlyBudgetBackupItem[];
  attachments: BackupV2AttachmentRecord[];
}

export interface BackupV2Preview {
  schemaVersion: 2;
  appVersion: string;
  exportedAt: number;
  exportedAtFormatted: string;
  currencyCode: string;
  totalExpenses: number;
  totalBudgets: number;
  totalAttachments: number;
  mediaIncluded: boolean;
  mediaBytes: number;
}

export interface ValidatedBackupV2 {
  manifest: BackupV2Manifest;
  zip: JSZip;
}

export interface BackupV2RestoreSummary {
  schemaVersion: 2;
  wasReplaced: boolean;
  expensesImported: number;
  expensesSkipped: number;
  budgetsImported: number;
  photosImported: number;
  photosSkipped: number;
  currencyUpdated: string | null;
  warnings: string[];
}

export interface BackupV2RestoreAdapters {
  getState(): FinancialState;
  getSettings(): BackupSettings;
  replaceState(state: FinancialState): Promise<void>;
  setSettings(settings: BackupSettings): Promise<void>;
  stageMedia(
    source: BackupV2AttachmentRecord,
    targetExpenseId: number,
    blob: Blob
  ): Promise<ExpenseAttachment>;
  deleteFiles(items: ExpenseAttachment[]): Promise<void>;
}

export interface BackupV2RestorePlan {
  nextExpenses: Expense[];
  nextBudgets: MonthlyBudget[];
  expenseIdMap: Map<number, number>;
  skippedExpenseIds: Set<number>;
  expensesImported: number;
  expensesSkipped: number;
  budgetsImported: number;
  currencyCode: string;
  currencyUpdated: string | null;
}

function safeMediaEntry(index: number, attachmentId: string): string {
  const safe = attachmentId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'attachment';
  return `media/${String(index + 1).padStart(4, '0')}-${safe}.jpg`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateZipStructure(bytes: Uint8Array): void {
  if (bytes.byteLength < 22) throw new Error('BACKUP_V2_ARCHIVE_CORRUPT');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = Math.max(0, bytes.byteLength - 65_557);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= minEocd; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('BACKUP_V2_ARCHIVE_CORRUPT');

  const diskNumber = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries <= 0 ||
    totalEntries > MAX_BACKUP_V2_ENTRIES ||
    centralOffset === 0xffffffff ||
    centralSize === 0xffffffff ||
    centralOffset + centralSize > eocd
  ) {
    throw new Error('BACKUP_V2_ARCHIVE_LIMIT');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const paths = new Set<string>();
  let offset = centralOffset;
  let totalUncompressed = 0;
  let manifestSeen = false;

  for (let index = 0; index < totalEntries; index++) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('BACKUP_V2_ARCHIVE_CORRUPT');
    }
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
    if (
      nextOffset > eocd ||
      fileNameLength <= 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      (flags & 0x0001) !== 0 ||
      ![0, 8].includes(compression)
    ) {
      throw new Error('BACKUP_V2_ARCHIVE_LIMIT');
    }

    let path: string;
    try {
      path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    } catch {
      throw new Error('BACKUP_V2_PATH_INVALID');
    }
    if (
      !path ||
      path.includes('\\') ||
      path.includes('\0') ||
      path.startsWith('/') ||
      /^[A-Za-z]:/.test(path) ||
      path.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error('BACKUP_V2_PATH_INVALID');
    }
    if (paths.has(path)) throw new Error('BACKUP_V2_DUPLICATE_PATH');
    paths.add(path);

    const isDirectory = path.endsWith('/');
    if (isDirectory) {
      if (path !== 'media/' || uncompressedSize !== 0) throw new Error('BACKUP_V2_PATH_INVALID');
    } else if (path === BACKUP_V2_MANIFEST_PATH) {
      if (manifestSeen || uncompressedSize <= 0 || uncompressedSize > MAX_BACKUP_MANIFEST_BYTES) {
        throw new Error('BACKUP_V2_MANIFEST_INVALID');
      }
      manifestSeen = true;
    } else if (/^media\/[A-Za-z0-9._-]+\.jpg$/.test(path)) {
      if (uncompressedSize <= 0 || uncompressedSize > MAX_BACKUP_MEDIA_BYTES) {
        throw new Error('BACKUP_V2_MEDIA_SIZE_MISMATCH');
      }
    } else {
      throw new Error('BACKUP_V2_PATH_INVALID');
    }

    totalUncompressed += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressed) || totalUncompressed > MAX_BACKUP_V2_UNCOMPRESSED_BYTES) {
      throw new Error('BACKUP_V2_ARCHIVE_LIMIT');
    }
    offset = nextOffset;
  }

  if (!manifestSeen || offset !== centralOffset + centralSize) {
    throw new Error('BACKUP_V2_ARCHIVE_CORRUPT');
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const copy = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return toHex(new Uint8Array(digest));
}

function normalizeBackupExpense(item: ExpenseBackupItem): Expense {
  return {
    id: item.id,
    amount: item.amount,
    description: item.description.trim(),
    category: item.category.trim(),
    date: item.date,
    note: item.note?.trim() || null,
    createdAt: item.createdAt,
  };
}

function isDuplicateExpense(incoming: ExpenseBackupItem, existing: Expense[]): boolean {
  return existing.some(
    (expense) =>
      (incoming.createdAt === expense.createdAt && Math.abs(incoming.amount - expense.amount) < 0.001) ||
      (incoming.date === expense.date &&
        Math.abs(incoming.amount - expense.amount) < 0.001 &&
        expense.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() &&
        expense.category.trim().toLowerCase() === incoming.category.trim().toLowerCase())
  );
}

function validateManifestShape(input: unknown): BackupV2Manifest {
  if (!isRecord(input)) throw new Error('BACKUP_V2_MANIFEST_INVALID');
  if (input.format !== BACKUP_V2_FORMAT) throw new Error('BACKUP_V2_FORMAT_INVALID');
  if (input.backupSchemaVersion !== BACKUP_V2_SCHEMA_VERSION) {
    throw new Error('BACKUP_V2_SCHEMA_UNSUPPORTED');
  }
  if (typeof input.appVersion !== 'string' || !input.appVersion.trim()) {
    throw new Error('BACKUP_V2_APP_VERSION_INVALID');
  }
  if (!Number.isFinite(input.exportedAt) || Number(input.exportedAt) <= 0) {
    throw new Error('BACKUP_V2_TIMESTAMP_INVALID');
  }
  if (typeof input.exportedAtFormatted !== 'string' || !input.exportedAtFormatted.trim()) {
    throw new Error('BACKUP_V2_TIMESTAMP_INVALID');
  }
  if (typeof input.mediaIncluded !== 'boolean') throw new Error('BACKUP_V2_MEDIA_FLAG_INVALID');
  if (!isRecord(input.counts)) throw new Error('BACKUP_V2_COUNTS_INVALID');
  if (!isRecord(input.settings)) throw new Error('BACKUP_V2_SETTINGS_INVALID');
  if (!Array.isArray(input.expenses) || !Array.isArray(input.monthlyBudgets) || !Array.isArray(input.attachments)) {
    throw new Error('BACKUP_V2_RECORDS_INVALID');
  }

  const manifest = input as unknown as BackupV2Manifest;
  const integerCounts = [
    manifest.counts.expenses,
    manifest.counts.budgets,
    manifest.counts.attachments,
    manifest.counts.mediaFiles,
    manifest.counts.mediaBytes,
  ];
  if (integerCounts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('BACKUP_V2_COUNTS_INVALID');
  }
  if (
    manifest.counts.expenses !== manifest.expenses.length ||
    manifest.counts.budgets !== manifest.monthlyBudgets.length ||
    manifest.counts.attachments !== manifest.attachments.length ||
    manifest.counts.mediaFiles !== (manifest.mediaIncluded ? manifest.attachments.length : 0)
  ) {
    throw new Error('BACKUP_V2_COUNTS_MISMATCH');
  }

  if (!['SYSTEM', 'LIGHT', 'DARK'].includes(manifest.settings.themeMode)) {
    throw new Error('BACKUP_V2_SETTINGS_INVALID');
  }
  if (!['en', 'fr', 'ar'].includes(manifest.settings.language)) {
    throw new Error('BACKUP_V2_SETTINGS_INVALID');
  }

  const normalizedState = validateFinancialState({
    expenses: manifest.expenses.map(normalizeBackupExpense),
    budgets: manifest.monthlyBudgets.map((item) => ({ ...item })),
    attachments: [],
    currencyCode: manifest.settings.currencyCode,
  });
  if (
    normalizedState.expenses.length !== manifest.expenses.length ||
    normalizedState.budgets.length !== manifest.monthlyBudgets.length
  ) {
    throw new Error('BACKUP_V2_RECORDS_INVALID');
  }

  const expenseIds = new Set(manifest.expenses.map((item) => item.id));
  const attachmentIds = new Set<string>();
  const storageKeys = new Set<string>();
  const mediaEntries = new Set<string>();
  const perExpense = new Map<number, number>();
  let declaredMediaBytes = 0;

  for (const attachment of manifest.attachments) {
    if (
      typeof attachment.id !== 'string' ||
      !attachment.id ||
      attachmentIds.has(attachment.id) ||
      !Number.isInteger(attachment.expenseId) ||
      !expenseIds.has(attachment.expenseId) ||
      typeof attachment.storageKey !== 'string' ||
      !attachment.storageKey ||
      storageKeys.has(attachment.storageKey) ||
      attachment.mimeType !== 'image/jpeg' ||
      !Number.isFinite(attachment.createdAt) ||
      attachment.createdAt <= 0 ||
      (attachment.originalFilename !== undefined &&
        attachment.originalFilename !== null &&
        typeof attachment.originalFilename !== 'string') ||
      !['purchase', 'receipt', 'proof'].includes(attachment.kind) ||
      !Number.isSafeInteger(attachment.byteSize) ||
      attachment.byteSize <= 0 ||
      attachment.byteSize > MAX_BACKUP_MEDIA_BYTES ||
      !Number.isSafeInteger(attachment.width) ||
      attachment.width <= 0 ||
      !Number.isSafeInteger(attachment.height) ||
      attachment.height <= 0
    ) {
      throw new Error('BACKUP_V2_ATTACHMENT_INVALID');
    }

    if (manifest.mediaIncluded) {
      if (
        typeof attachment.mediaEntry !== 'string' ||
        !/^media\/[A-Za-z0-9._-]+\.jpg$/.test(attachment.mediaEntry) ||
        attachment.mediaEntry.includes('..') ||
        mediaEntries.has(attachment.mediaEntry)
      ) {
        throw new Error('BACKUP_V2_MEDIA_ENTRY_INVALID');
      }
      if (
        attachment.checksumSha256 !== null &&
        (typeof attachment.checksumSha256 !== 'string' ||
          !/^[a-f0-9]{64}$/.test(attachment.checksumSha256))
      ) {
        throw new Error('BACKUP_V2_CHECKSUM_INVALID');
      }
      mediaEntries.add(attachment.mediaEntry);
      declaredMediaBytes += attachment.byteSize;
    } else if (attachment.mediaEntry !== null || attachment.checksumSha256 !== null) {
      throw new Error('BACKUP_V2_DATA_ONLY_MEDIA_INVALID');
    }

    attachmentIds.add(attachment.id);
    storageKeys.add(attachment.storageKey);
    const count = (perExpense.get(attachment.expenseId) || 0) + 1;
    if (count > 8) throw new Error('BACKUP_V2_ATTACHMENT_LIMIT');
    perExpense.set(attachment.expenseId, count);
  }

  if (manifest.counts.mediaBytes !== (manifest.mediaIncluded ? declaredMediaBytes : 0)) {
    throw new Error('BACKUP_V2_MEDIA_BYTES_MISMATCH');
  }
  return manifest;
}

export async function createBackupV2Archive(options: {
  appVersion: string;
  state: FinancialState;
  settings: BackupSettings;
  includeMedia: boolean;
  readMedia: (attachment: ExpenseAttachment) => Promise<Blob>;
}): Promise<Blob> {
  const state = validateFinancialState(options.state);
  const now = Date.now();
  const zip = new JSZip();
  const attachmentRecords: BackupV2AttachmentRecord[] = [];
  let mediaBytes = 0;

  for (let index = 0; index < state.attachments.length; index++) {
    const attachment = state.attachments[index];
    const mediaEntry = options.includeMedia ? safeMediaEntry(index, attachment.id) : null;
    let byteSize = attachment.byteSize;
    let checksumSha256: string | null = null;

    if (options.includeMedia) {
      const blob = await options.readMedia(attachment);
      if (!blob || blob.size <= 0 || blob.size > MAX_BACKUP_MEDIA_BYTES) {
        throw new Error('BACKUP_V2_MEDIA_INVALID');
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      byteSize = bytes.byteLength;
      checksumSha256 = await sha256Hex(bytes);
      mediaBytes += byteSize;
      zip.file(mediaEntry!, bytes, { binary: true, compression: 'STORE' });
    }

    attachmentRecords.push({
      id: attachment.id,
      expenseId: attachment.expenseId,
      storageKey: attachment.storageKey,
      mimeType: 'image/jpeg',
      createdAt: attachment.createdAt,
      originalFilename: attachment.originalFilename ?? null,
      kind: attachment.kind,
      byteSize,
      width: attachment.width,
      height: attachment.height,
      mediaEntry,
      checksumSha256,
    });
  }

  const manifest: BackupV2Manifest = {
    format: BACKUP_V2_FORMAT,
    backupSchemaVersion: BACKUP_V2_SCHEMA_VERSION,
    appVersion: options.appVersion,
    exportedAt: now,
    exportedAtFormatted: new Date(now).toISOString().replace('T', ' ').substring(0, 19),
    mediaIncluded: options.includeMedia,
    counts: {
      expenses: state.expenses.length,
      budgets: state.budgets.length,
      attachments: attachmentRecords.length,
      mediaFiles: options.includeMedia ? attachmentRecords.length : 0,
      mediaBytes: options.includeMedia ? mediaBytes : 0,
    },
    settings: {
      currencyCode: state.currencyCode,
      themeMode: options.settings.themeMode,
      language: options.settings.language,
    },
    expenses: state.expenses.map((expense) => ({
      id: expense.id,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      date: expense.date,
      dateFormatted: formatDate(expense.date),
      note: expense.note ?? null,
      createdAt: expense.createdAt,
    })),
    monthlyBudgets: state.budgets.map((budget) => ({ ...budget })),
    attachments: attachmentRecords,
  };

  validateManifestShape(manifest);
  zip.file(BACKUP_V2_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function validateBackupV2Archive(input: Blob): Promise<ValidatedBackupV2> {
  if (!input || input.size <= 0 || input.size > MAX_BACKUP_V2_ARCHIVE_BYTES) {
    throw new Error('BACKUP_V2_ARCHIVE_SIZE_INVALID');
  }

  const archiveBytes = new Uint8Array(await input.arrayBuffer());
  validateZipStructure(archiveBytes);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archiveBytes, { checkCRC32: true });
  } catch {
    throw new Error('BACKUP_V2_ARCHIVE_CORRUPT');
  }

  const manifestFile = zip.file(BACKUP_V2_MANIFEST_PATH);
  if (!manifestFile) throw new Error('BACKUP_V2_MANIFEST_MISSING');

  let parsed: unknown;
  try {
    parsed = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new Error('BACKUP_V2_MANIFEST_INVALID');
  }

  const manifest = validateManifestShape(parsed);
  const mediaPaths = Object.keys(zip.files).filter((path) => path.startsWith('media/') && !zip.files[path].dir);
  if (mediaPaths.length !== manifest.counts.mediaFiles) {
    throw new Error('BACKUP_V2_MEDIA_COUNT_MISMATCH');
  }

  if (manifest.mediaIncluded) {
    for (const attachment of manifest.attachments) {
      const entry = attachment.mediaEntry ? zip.file(attachment.mediaEntry) : null;
      if (!entry) throw new Error('BACKUP_V2_MEDIA_MISSING');
      const bytes = await entry.async('uint8array');
      if (bytes.byteLength !== attachment.byteSize) throw new Error('BACKUP_V2_MEDIA_SIZE_MISMATCH');
      if (attachment.checksumSha256) {
        const actual = await sha256Hex(bytes);
        if (!actual || actual !== attachment.checksumSha256) {
          throw new Error('BACKUP_V2_MEDIA_CHECKSUM_MISMATCH');
        }
      }
    }
  }

  return { manifest, zip };
}

export function previewValidatedBackupV2(validated: ValidatedBackupV2): BackupV2Preview {
  const manifest = validated.manifest;
  return {
    schemaVersion: 2,
    appVersion: manifest.appVersion,
    exportedAt: manifest.exportedAt,
    exportedAtFormatted: manifest.exportedAtFormatted,
    currencyCode: manifest.settings.currencyCode,
    totalExpenses: manifest.counts.expenses,
    totalBudgets: manifest.counts.budgets,
    totalAttachments: manifest.counts.attachments,
    mediaIncluded: manifest.mediaIncluded,
    mediaBytes: manifest.counts.mediaBytes,
  };
}

export async function readValidatedBackupMedia(
  validated: ValidatedBackupV2,
  attachment: BackupV2AttachmentRecord
): Promise<Blob> {
  if (!validated.manifest.mediaIncluded || !attachment.mediaEntry) {
    throw new Error('BACKUP_V2_MEDIA_NOT_INCLUDED');
  }
  const entry = validated.zip.file(attachment.mediaEntry);
  if (!entry) throw new Error('BACKUP_V2_MEDIA_MISSING');
  const bytes = await entry.async('uint8array');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type: attachment.mimeType });
}

export function planBackupV2Restore(
  manifest: BackupV2Manifest,
  existingState: FinancialState,
  replaceExisting: boolean
): BackupV2RestorePlan {
  const current = validateFinancialState(existingState);
  const currentHasFinancialData = current.expenses.length > 0 || current.budgets.length > 0;
  const backupHasFinancialData = manifest.expenses.length > 0 || manifest.monthlyBudgets.length > 0;

  if (
    !replaceExisting &&
    currentHasFinancialData &&
    backupHasFinancialData &&
    manifest.settings.currencyCode !== current.currencyCode
  ) {
    throw new Error('BACKUP_CURRENCY_MISMATCH');
  }

  const expenseIdMap = new Map<number, number>();
  const skippedExpenseIds = new Set<number>();
  const importedExpenses: Expense[] = [];
  const knownExpenses = replaceExisting ? [] : current.expenses.map((item) => ({ ...item }));
  let maxId = knownExpenses.reduce((max, expense) => Math.max(max, expense.id), 0);

  for (const incoming of manifest.expenses) {
    if (!replaceExisting && isDuplicateExpense(incoming, knownExpenses)) {
      skippedExpenseIds.add(incoming.id);
      continue;
    }

    let targetId = incoming.id;
    if (!replaceExisting) {
      const conflict = knownExpenses.some((expense) => expense.id === targetId);
      if (conflict) {
        targetId = ++maxId;
      } else {
        maxId = Math.max(maxId, targetId);
      }
    }

    const imported = { ...normalizeBackupExpense(incoming), id: targetId };
    expenseIdMap.set(incoming.id, targetId);
    importedExpenses.push(imported);
    knownExpenses.push(imported);
  }

  const nextExpenses = replaceExisting
    ? importedExpenses
    : [...importedExpenses, ...current.expenses.map((item) => ({ ...item }))];

  const budgetMap = new Map<string, MonthlyBudget>();
  if (!replaceExisting) current.budgets.forEach((budget) => budgetMap.set(budget.monthKey, { ...budget }));
  let budgetsImported = 0;
  for (const incoming of manifest.monthlyBudgets) {
    if (!replaceExisting && budgetMap.has(incoming.monthKey)) continue;
    budgetMap.set(incoming.monthKey, { ...incoming });
    budgetsImported++;
  }

  const adoptBackupCurrency = replaceExisting || (!currentHasFinancialData && backupHasFinancialData);
  return {
    nextExpenses,
    nextBudgets: Array.from(budgetMap.values()),
    expenseIdMap,
    skippedExpenseIds,
    expensesImported: importedExpenses.length,
    expensesSkipped: skippedExpenseIds.size,
    budgetsImported,
    currencyCode: adoptBackupCurrency ? manifest.settings.currencyCode : current.currencyCode,
    currencyUpdated: adoptBackupCurrency ? manifest.settings.currencyCode : null,
  };
}

export async function restoreBackupV2WithAdapters(
  input: Blob,
  replaceExisting: boolean,
  adapters: BackupV2RestoreAdapters
): Promise<BackupV2RestoreSummary> {
  const validated = await validateBackupV2Archive(input);
  const manifest = validated.manifest;
  const oldState = validateFinancialState(adapters.getState());
  const oldSettings = adapters.getSettings();
  const plan = planBackupV2Restore(manifest, oldState, replaceExisting);
  const staged: ExpenseAttachment[] = [];
  let photosSkipped = 0;
  let mutationAttempted = false;
  let settingsApplied = false;

  try {
    if (manifest.mediaIncluded) {
      for (const source of manifest.attachments) {
        const targetExpenseId = plan.expenseIdMap.get(source.expenseId);
        if (targetExpenseId === undefined) {
          photosSkipped++;
          continue;
        }
        const blob = await readValidatedBackupMedia(validated, source);
        const stagedAttachment = await adapters.stageMedia(source, targetExpenseId, blob);
        staged.push(stagedAttachment);
      }
    } else {
      photosSkipped = manifest.attachments.filter((item) => plan.expenseIdMap.has(item.expenseId)).length;
    }

    const nextState = validateFinancialState({
      expenses: plan.nextExpenses,
      budgets: plan.nextBudgets,
      attachments: replaceExisting
        ? staged
        : [...oldState.attachments.map((item) => ({ ...item })), ...staged],
      currencyCode: plan.currencyCode,
    });

    mutationAttempted = true;
    await adapters.replaceState(nextState);

    if (replaceExisting) {
      await adapters.setSettings({
        currencyCode: plan.currencyCode,
        themeMode: manifest.settings.themeMode,
        language: manifest.settings.language,
      });
      settingsApplied = true;
    }

    const warnings: string[] = [];
    if (replaceExisting && oldState.attachments.length > 0) {
      try {
        await adapters.deleteFiles(oldState.attachments);
      } catch {
        warnings.push('POST_COMMIT_MEDIA_CLEANUP_FAILED');
      }
    }

    return {
      schemaVersion: 2,
      wasReplaced: replaceExisting,
      expensesImported: plan.expensesImported,
      expensesSkipped: plan.expensesSkipped,
      budgetsImported: plan.budgetsImported,
      photosImported: staged.length,
      photosSkipped,
      currencyUpdated: plan.currencyUpdated,
      warnings,
    };
  } catch (error) {
    let rollbackSucceeded = true;
    if (mutationAttempted) {
      try {
        await adapters.replaceState(oldState);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }
    }
    if (settingsApplied || replaceExisting) {
      try {
        await adapters.setSettings(oldSettings);
      } catch {
        // Keep the original restore error. Structured data is the higher priority.
      }
    }
    if (rollbackSucceeded && staged.length > 0) {
      try {
        await adapters.deleteFiles(staged);
      } catch {
        // Harmless staged orphans can be removed by Media Integrity later.
      }
    }
    if (!rollbackSucceeded) throw new Error('BACKUP_V2_ROLLBACK_FAILED');
    throw error;
  }
}
