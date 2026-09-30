import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const addEdit = readFileSync('src/components/AddEditExpenseModal.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const history = readFileSync('src/screens/HistoryScreen.tsx', 'utf8');
const stats = readFileSync('src/screens/StatisticsScreen.tsx', 'utf8');
const detail = readFileSync('src/components/ExpenseDetailModal.tsx', 'utf8');

test('manual Add Expense fields appear before optional capture tools', () => {
  const essentials = [
    "t(language, 'amountLabel')",
    "t(language, 'descriptionLabel')",
    "t(language, 'categoryLabel')",
    "t(language, 'dateLabel')",
  ];
  const optionalIndex = addEdit.indexOf('{optionalCopy.title}');
  assert.ok(optionalIndex > 0);
  for (const marker of essentials) {
    const index = addEdit.indexOf(marker);
    assert.ok(index >= 0, `missing essential field marker: ${marker}`);
    assert.ok(index < optionalIndex, `${marker} must stay before optional tools`);
  }
});

test('only the selected optional tool is rendered', () => {
  assert.match(addEdit, /activeTool === 'smart'.*SmartCaptureCard/s);
  assert.match(addEdit, /activeTool === 'receipt'.*ReceiptScanCard/s);
  assert.match(addEdit, /activeTool === 'photos'.*ExpenseAttachmentsEditor/s);
  assert.match(addEdit, /current === tool \? null : tool/);
});

test('History and Statistics route to read-only detail while Dashboard retains editing', () => {
  assert.match(app, /DashboardScreen[\s\S]*onExpenseClick=\{\(expense\) => setEditingExpense\(expense\)\}/);
  assert.match(app, /HistoryScreen[\s\S]*onExpenseClick=\{\(expense\) => setViewingExpense\(expense\)\}/);
  assert.match(app, /StatisticsScreen[\s\S]*onNavigateToExpense=\{\(expense\) => setViewingExpense\(expense\)\}/);
  assert.match(app, /<ExpenseDetailModal/);
});

test('History uses immediate staged deletion with Undo and does not expose edit routing', () => {
  assert.match(history, /onDeleteExpense\(expense\)/);
  assert.doesNotMatch(history, /<ConfirmationModal|expenseToDelete/);
  assert.doesNotMatch(history, /setEditingExpense|editExpenseBtnLabel/);
});

test('read-only expense detail has photos and no edit or delete control', () => {
  assert.match(detail, /AttachmentStorage\.getAttachmentsForExpense/);
  assert.match(detail, /data-attachment-viewer="true"/);
  assert.doesNotMatch(detail, /onEdit|Edit2|Trash2|onDelete/);
});

test('Statistics expense rows support keyboard activation', () => {
  assert.match(stats, /onKeyDown=\{\(event\) => \{/);
  assert.match(stats, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(stats, /onNavigateToExpense\(exp\)/);
});

test('Add/Edit consumes Escape and native Back without switching tools mid-photo work', () => {
  assert.match(addEdit, /spendwise-native-back/);
  assert.match(addEdit, /disabled=\{isSaving \|\| isPhotoPreparing\}/);
});
