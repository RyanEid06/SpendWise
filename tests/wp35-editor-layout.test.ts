import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEditorLayout } from '../scripts/wp35/editorLayout';

const fixture = () => ({ viewport: { top: 0, height: 400, width: 390 }, padding: { top: 42, bottom: 38, left: 14, right: 14 },
  card: { top: 42, bottom: 362, left: 14, right: 376 }, header: { top: 42, bottom: 100, left: 14, right: 376 },
  footer: { top: 302, bottom: 362, left: 14, right: 376 }, field: { top: 140, bottom: 184, left: 30, right: 360 },
  scroll: { top: 100, bottom: 302, left: 14, right: 376 } });
test('native layout receipt proves system-bar breathing room and focused input reachability', () => {
  assert.doesNotThrow(() => assertEditorLayout(fixture()));
  const keyboard = fixture(); keyboard.viewport.top = 25; keyboard.viewport.height = 375;
  keyboard.card.top = 67; keyboard.header.top = 67;
  assert.doesNotThrow(() => assertEditorLayout(keyboard));
});
test('native layout gate rejects covered header, footer and focused input', () => {
  for (const bad of [
    { ...fixture(), card: { ...fixture().card, top: 0 } },
    { ...fixture(), footer: { ...fixture().footer, bottom: 395 } },
    { ...fixture(), field: { ...fixture().field, bottom: 350 } },
    { ...fixture(), padding: { ...fixture().padding, bottom: 0 } },
  ]) assert.throws(() => assertEditorLayout(bad));
});
