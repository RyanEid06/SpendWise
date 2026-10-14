import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticationPrompt } from '../src/security/authenticationCopy';

test('WP38 native Arabic prompt isolates the Latin brand without changing operation-specific security text', () => {
  const unlock = authenticationPrompt('unlock', 'ar');
  assert.equal(unlock.title, 'فتح \u2066SpendWise\u2069');
  assert.equal(unlock.reason, 'أكّد هويتك للوصول إلى بياناتك المحمية.');
  assert.equal(unlock.retry, 'إعادة المحاولة بالبصمة');
  assert.equal(unlock.explanation, 'أعد المحاولة بالبصمة أو استخدم قفل شاشة هاتفك.');
  const clear = authenticationPrompt('clear-app-data', 'ar');
  assert.equal(clear.title, 'مسح البيانات المالية');
  assert.equal(clear.reason, 'أكّد هويتك قبل حذف بياناتك المالية المحمية.');
  assert.equal(authenticationPrompt('unlock', 'en').title, 'Unlock SpendWise');
  assert.equal(authenticationPrompt('unlock', 'fr').title, 'Déverrouiller SpendWise');
});
