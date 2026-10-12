import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorageFailureScreen } from '../src/screens/StorageFailureScreen';

for (const [language, title] of [['en', 'SpendWise could not safely open local data'], ['fr', 'SpendWise ne peut pas ouvrir les données locales en toute sécurité'], ['ar', 'تعذر على SpendWise فتح البيانات المحلية بأمان']] as const) {
  test(`fatal startup renders safe recovery copy without storage access in ${language}`, () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage unavailable'); } });
    try {
      const markup = renderToStaticMarkup(React.createElement(StorageFailureScreen, { language }));
      assert.ok(markup.includes(title));
      assert.ok(!markup.includes('Keystore') && !markup.includes('LOCAL_DATA_OPEN_FAILED'));
      assert.ok(markup.includes(language === 'ar' ? 'dir="rtl"' : 'dir="ltr"'));
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete (globalThis as Record<string, unknown>).localStorage;
    }
  });
}
