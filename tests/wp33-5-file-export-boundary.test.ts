import assert from 'node:assert/strict';
import test from 'node:test';

async function installNativePluginBridge(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const oldPlatform = Object.getOwnPropertyDescriptor(globalThis, 'CapacitorCustomPlatform');
  Object.defineProperty(globalThis, 'CapacitorCustomPlatform', { configurable: true, value: { name: 'android' } });
  const { Capacitor } = await import('@capacitor/core');
  const native = Capacitor as typeof Capacitor & {
    PluginHeaders?: { name: string; methods: { name: string; rtype: string }[] }[];
    nativePromise: (plugin: string, method: string, options: Record<string, unknown>) => Promise<unknown>;
  };
  const oldHeaders = native.PluginHeaders;
  const oldNativePromise = Object.getOwnPropertyDescriptor(native, 'nativePromise');
  native.PluginHeaders = [
    ...(oldHeaders ?? []),
    { name: 'Filesystem', methods: [
      { name: 'mkdir', rtype: 'promise' }, { name: 'stat', rtype: 'promise' }, { name: 'writeFile', rtype: 'promise' },
    ] },
    { name: 'Share', methods: [{ name: 'canShare', rtype: 'promise' }, { name: 'share', rtype: 'promise' }] },
  ];
  const [{ Directory }, { exportBlobFile, exportTextFile }] = await Promise.all([
    import('@capacitor/filesystem'), import('../src/utils/fileExport'), import('@capacitor/share'),
  ]).then(([filesystem, fileExport]) => [filesystem, fileExport] as const);
  if (!oldNativePromise) native.nativePromise = async () => { throw new Error('Unexpected native call'); };
  t.after(() => {
    native.PluginHeaders = oldHeaders;
    if (oldNativePromise) Object.defineProperty(native, 'nativePromise', oldNativePromise);
    else Reflect.deleteProperty(native, 'nativePromise');
    if (oldPlatform) Object.defineProperty(globalThis, 'CapacitorCustomPlatform', oldPlatform);
    else Reflect.deleteProperty(globalThis, 'CapacitorCustomPlatform');
  });
  t.mock.method(Capacitor, 'isNativePlatform', () => true);
  return { native, Directory, exportBlobFile, exportTextFile };
}

test('native text exports share the URI returned for an app-owned share-cache path', async (t) => {
  const { native, Directory, exportTextFile } = await installNativePluginBridge(t);
  let written: Record<string, unknown> | undefined;
  let shared: Record<string, unknown> | undefined;
  const calls: string[] = [];
  let createdDirectory: Record<string, unknown> | undefined;
  let checkedDirectory: Record<string, unknown> | undefined;
  native.nativePromise = async (plugin, method, options) => {
    calls.push(`${plugin}.${method}`);
    if (plugin === 'Filesystem' && method === 'mkdir') { createdDirectory = options; throw new Error('directory already exists'); }
    if (plugin === 'Filesystem' && method === 'stat') { checkedDirectory = options; return { type: 'directory' }; }
    if (plugin === 'Filesystem' && method === 'writeFile') {
      written = options;
      return { uri: 'file:///data/user/0/com.spendwise.app/cache/shared/report.json' };
    }
    if (plugin === 'Share' && method === 'canShare') return { value: true };
    if (plugin === 'Share' && method === 'share') { shared = options; return {}; }
    throw new Error(`Unexpected native call ${plugin}.${method}`);
  };

  await exportTextFile({ fileName: 'report.json', content: '{}', mimeType: 'application/json', shareTitle: 'Report' });

  assert.equal(written?.directory, Directory.Cache);
  assert.equal(written?.path, 'shared/report.json');
  assert.deepEqual(calls.slice(0, 3), ['Filesystem.mkdir', 'Filesystem.stat', 'Filesystem.writeFile']);
  assert.deepEqual(createdDirectory, {
    path: 'shared', directory: Directory.Cache, recursive: true,
  });
  assert.deepEqual(checkedDirectory, { path: 'shared', directory: Directory.Cache });
  assert.deepEqual(shared?.files, ['file:///data/user/0/com.spendwise.app/cache/shared/report.json']);
});

test('native binary exports contain path-like filenames within the share-cache directory', async (t) => {
  const { native, Directory, exportBlobFile } = await installNativePluginBridge(t);
  let written: Record<string, unknown> | undefined;
  native.nativePromise = async (plugin, method, options) => {
    if (plugin === 'Filesystem' && method === 'mkdir') return;
    if (plugin === 'Filesystem' && method === 'writeFile') {
      written = options;
      return { uri: 'file:///data/user/0/com.spendwise.app/cache/shared/photo.jpg' };
    }
    if (plugin === 'Share' && method === 'canShare') return { value: true };
    if (plugin === 'Share' && method === 'share') return {};
    throw new Error(`Unexpected native call ${plugin}.${method}`);
  };

  await exportBlobFile({ fileName: '../private/photo.jpg', blob: new Blob(['photo']), shareTitle: 'Photo' });

  assert.equal(written?.directory, Directory.Cache);
  assert.equal(written?.path, 'shared/photo.jpg');
});

test('native exports reject path-only filenames before creating or writing in the share directory', async (t) => {
  const { native, exportTextFile } = await installNativePluginBridge(t);
  const calls: string[] = [];
  native.nativePromise = async (plugin, method) => { calls.push(`${plugin}.${method}`); return {}; };

  await assert.rejects(() => exportTextFile({
    fileName: '../..', content: '{}', mimeType: 'application/json', shareTitle: 'Report',
  }), /Invalid export filename/);
  assert.deepEqual(calls, []);
});
