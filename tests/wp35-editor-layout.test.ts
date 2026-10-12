import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEditorLayout } from '../scripts/wp35/editorLayout';

const fixture = () => ({ viewport: { top: 0, height: 400, width: 390 }, padding: { top: 42, bottom: 38, left: 14, right: 14 },
  nativeInsets: { top: 28, bottom: 24, left: 0, right: 0 },
  card: { top: 42, bottom: 362, left: 14, right: 376 }, header: { top: 42, bottom: 100, left: 14, right: 376 },
  footer: { top: 302, bottom: 362, left: 14, right: 376 }, field: { top: 140, bottom: 184, left: 30, right: 360 },
  scroll: { top: 100, bottom: 302, left: 14, right: 376 } });
test('native layout receipt proves system-bar breathing room and focused input reachability', () => {
  assert.doesNotThrow(() => assertEditorLayout(fixture()));
  const keyboard = fixture(); keyboard.viewport.top = 25; keyboard.viewport.height = 375;
  keyboard.card.top = 67; keyboard.header.top = 67;
  assert.doesNotThrow(() => assertEditorLayout(keyboard));
});

test('native layout gate requires propagated insets exactly once plus breathing room', () => {
  const omitted = fixture();
  omitted.padding.top = 14; omitted.card.top = 14; omitted.header.top = 14;
  assert.throws(() => assertEditorLayout(omitted));
  const doubled = fixture();
  doubled.padding.top = 70; doubled.card.top = 70; doubled.header.top = 70;
  assert.throws(() => assertEditorLayout(doubled));
  const consumed = fixture();
  consumed.nativeInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  consumed.padding = { top: 14, bottom: 14, left: 14, right: 14 };
  consumed.card.top = 14; consumed.header.top = 14;
  assert.doesNotThrow(() => assertEditorLayout(consumed));
  const doubleConsumed = { ...consumed, padding: { ...consumed.padding, top: 42 } };
  doubleConsumed.card = { ...consumed.card, top: 42 }; doubleConsumed.header = { ...consumed.header, top: 42 };
  assert.throws(() => assertEditorLayout(doubleConsumed));
});
test('native layout gate rejects covered header, footer and focused input', () => {
  for (const bad of [
    { ...fixture(), card: { ...fixture().card, top: 0 } },
    { ...fixture(), footer: { ...fixture().footer, bottom: 395 } },
    { ...fixture(), field: { ...fixture().field, bottom: 350 } },
    { ...fixture(), padding: { ...fixture().padding, bottom: 0 } },
  ]) assert.throws(() => assertEditorLayout(bad));
});
