import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('native acquisition reads bypass HTTP cache and dispose the private copy before acknowledgment', async () => {
  const calls: string[] = [];
  const uri = 'file:///data/user/0/com.spendwise.app/cache/fixture.jpg';
  const webPath = 'https://localhost/_capacitor_file_/data/user/0/com.spendwise.app/cache/fixture.jpg';
  const exports: any = {};
  const source = ts.transpileModule(readFileSync('src/utils/imageAcquisition.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports, File, Blob, Date,
    fetch: async (url: string, options: RequestInit) => {
      assert.equal(url, webPath);
      assert.equal(options?.cache, 'no-store', 'Acquired photo bytes must bypass persistent WebView HTTP cache');
      calls.push('read');
      return new Response(new Blob(['private photo'], { type: 'image/jpeg' }));
    },
    require: (name: string) => {
      if (name === '@capacitor/camera') return {
        MediaTypeSelection: { Photo: 0 },
        Camera: { chooseFromGallery: async () => ({ results: [{ uri, webPath }] }) },
      };
      if (name === '@capacitor/core') return {
        Capacitor: { getPlatform: () => 'android' },
        registerPlugin: () => ({ dispose: async (options: { path: string }) => {
          assert.equal(options.path, uri);
          calls.push('dispose');
        } }),
      };
      throw new Error('Unexpected platform dependency');
    },
  });
  const acquired = (await exports.choosePhotos(1))[0];
  const file = await acquired.loadFile();
  calls.push('acknowledged');
  assert.deepEqual(calls, ['read', 'dispose', 'acknowledged']);
  assert.equal(await file.text(), 'private photo');
  assert.equal(file.type, 'image/jpeg');
});
