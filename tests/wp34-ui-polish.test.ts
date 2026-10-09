import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Expense, ExpenseAttachment } from '../src/types';
import { filterMediaGroupsByDay, groupMediaByCategory, groupMediaByExpenseDate } from '../src/utils/mediaLibraryGrouping';

const source = (path: string) => readFileSync(path, 'utf8');
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12).getTime();
const expense = (id: number, category: string, date: number): Expense => ({
  id, category, date, amount: 1, description: `Expense ${id}`, createdAt: date,
});
const photo = (id: string, expenseId: number, createdAt: number): ExpenseAttachment => ({
  id, expenseId, createdAt, storageKey: `test/${id}`, kind: 'receipt', mimeType: 'image/jpeg',
  byteSize: 1, width: 1, height: 1,
});

test('WP34: day filter matches the date displayed in All, not the attachment-created date', () => {
  const expenses = [expense(1, 'Food', day(2025, 12, 31)), expense(2, 'Travel', day(2026, 1, 1))];
  const groups = groupMediaByExpenseDate([
    photo('receipt-before-year', 1, day(2026, 1, 3)),
    photo('travel', 2, day(2026, 1, 3)),
  ], expenses);
  assert.deepEqual(filterMediaGroupsByDay(groups, day(2025, 12, 31)).flatMap((g) => g.items.map((p) => p.id)), ['receipt-before-year']);
  assert.deepEqual(filterMediaGroupsByDay(groups, day(2026, 1, 1)).flatMap((g) => g.items.map((p) => p.id)), ['travel']);
  assert.deepEqual(filterMediaGroupsByDay(groups, day(2024, 1, 1)), []);
  assert.deepEqual(filterMediaGroupsByDay(groups, Number.NaN), []);
});

test('WP34: orphan photos remain accessible as uncategorized and category is normalized', () => {
  const expenses = [expense(1, 'Food & Beverage', day(2026, 10, 1)), expense(2, 'Food', day(2026, 10, 2)), expense(3, 'Travel', day(2026, 10, 3))];
  const attachments = [photo('a', 1, day(2026, 10, 1)), photo('b', 2, day(2026, 10, 2)), photo('c', 3, day(2026, 10, 3)), photo('orphan', 888, day(2026, 10, 4))];
  const groups = groupMediaByCategory(attachments, expenses);
  assert.equal(groups.find((g) => g.category === 'Food')?.items.length, 2);
  assert.deepEqual(groups.find((g) => g.category === null)?.items.map((p) => p.id), ['orphan']);
  assert.equal(groups.flatMap((g) => g.items).length, attachments.length);
  assert.equal(new Set(groups.flatMap((g) => g.items.map((p) => p.id))).size, attachments.length);
  assert.deepEqual(groupMediaByCategory([], expenses), []);
});

test('WP34: Media Library uses History-style controls and retains actionable corruption repair', () => {
  const ui = source('src/screens/MediaLibraryScreen.tsx');
  assert.match(ui, /role="tablist" aria-label=\{text\.filters\}/);
  assert.match(ui, /\['ALL', text\.all\].*\['DAY', text\.day\].*\['CATEGORY', text\.category\]/);
  assert.match(ui, /type="date" value=\{dateInputValue\(dayAnchor\)\}/);
  assert.match(ui, /setSelectedDay\(shiftLocalDay\(dayAnchor, -1\)\)/);
  assert.match(ui, /setSelectedDay\(shiftLocalDay\(dayAnchor, 1\)\)/);
  assert.match(ui, /groupMediaByCategory\(attachments, expenses\)/);
  assert.match(ui, /aria-expanded=\{expanded\}/);
  assert.match(ui, /report && !report\.healthy &&/);
  assert.match(ui, /AttachmentStorage\.auditIntegrity\(\)/);
  assert.match(ui, /AttachmentStorage\.repairIntegrity\(\)/);
  assert.match(ui, /photos: 'Photos'/);
  assert.match(ui, /uncategorized: 'Sans catégorie'/);
  assert.match(ui, /uncategorized: 'غير مصنفة'/);
});

test('WP34: Photos capitalization and user-visible version omit build number', () => {
  const copy = source('src/features/settings/settingsCopy.ts');
  const settings = source('src/features/settings/SettingsOverview.tsx');
  assert.match(copy, /photosLabel: 'Photos'/);
  assert.match(source('src/screens/SettingsScreen.tsx'), /\{copy\.photosLabel\}/);
  assert.match(settings, /\{APP_VERSION_NAME\}/);
  assert.doesNotMatch(settings, /\{APP_VERSION_CODE\}/);
  assert.doesNotMatch(settings, /\{copy\.build\}/);
});

test('WP34: both splash assets have high resolution and transparent padding', () => {
  for (const directory of ['drawable-nodpi', 'drawable-night-nodpi']) {
    const png = readFileSync(`android/app/src/main/res/${directory}/spendwise_splash_icon.png`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 864);
    assert.equal(png.readUInt32BE(20), 864);
    assert.equal(png[25], 6); // RGBA; border remains fully transparent
  }
  const lock = source('src/screens/LockScreen.tsx');
  assert.match(lock, /autoAttempted = useRef\(false\)/);
  assert.match(lock, /<SpendWiseLogo/);
});
