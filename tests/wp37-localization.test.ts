import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS } from '../src/utils/translations';
import { WP17_COPY } from '../src/utils/wp17Copy';
import { overviewCopy } from '../src/features/settings/settingsCopy';
import { ATTACHMENT_TRANSLATIONS } from '../src/utils/attachmentTranslations';
import { aiProgressCopy } from '../src/components/AiProgressPanel';
import { storageFailureCopy } from '../src/screens/StorageFailureScreen';
import { AUTHENTICATION_COPY, AUTHENTICATION_RECOVERY_COPY, AUTHENTICATION_LIMIT_COPY } from '../src/security/authenticationCopy';
import { backupRestoreCopy } from '../src/features/backup/restoreCopy';
import { statisticsCopy } from '../src/features/statistics/copy';

function flatten(value: unknown, path = ''): Record<string, string> {
  if (typeof value === 'string') return { [path]: value };
  assert.ok(value && typeof value === 'object');
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => Object.entries(flatten(child, path ? `${path}.${key}` : key))));
}
function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{([A-Za-z][\w]*)\}/g)].map(match => match[1]))].sort();
}
for (const [name, dictionary] of Object.entries({ main: TRANSLATIONS, wp17: WP17_COPY, settings: overviewCopy, attachments: ATTACHMENT_TRANSLATIONS, progress: aiProgressCopy, startup: storageFailureCopy, authentication: AUTHENTICATION_COPY, authenticationRecovery: AUTHENTICATION_RECOVERY_COPY, authenticationLimit: AUTHENTICATION_LIMIT_COPY, restore: backupRestoreCopy, statistics: statisticsCopy })) {
  test(`${name} EN/FR/AR key and interpolation parity`, () => {
    const english = flatten(dictionary.en);
    for (const language of ['fr', 'ar'] as const) {
      const localized = flatten(dictionary[language]);
      assert.deepEqual(Object.keys(localized).sort(), Object.keys(english).sort(), `${name}/${language} keys`);
      for (const key of Object.keys(english)) assert.deepEqual(placeholders(localized[key]), placeholders(english[key]), `${name}/${language}/${key} placeholders`);
    }
  });
}
