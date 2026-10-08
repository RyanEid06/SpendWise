import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface TextFileExportOptions {
  fileName: string;
  content: string;
  mimeType: string;
  shareTitle: string;
}

const NATIVE_SHARE_DIRECTORY = 'shared';

async function getNativeSharePath(fileName: string): Promise<string> {
  const safeFileName = fileName.replace(/\\/g, '/').split('/').filter(Boolean).at(-1);
  if (!safeFileName || safeFileName === '.' || safeFileName === '..' || /[\u0000-\u001f\u007f]/.test(safeFileName)) {
    throw new Error('Invalid export filename.');
  }

  try {
    await Filesystem.mkdir({ path: NATIVE_SHARE_DIRECTORY, directory: Directory.Cache, recursive: true });
  } catch (createError) {
    try {
      const existing = await Filesystem.stat({ path: NATIVE_SHARE_DIRECTORY, directory: Directory.Cache });
      if (existing.type !== 'directory') throw createError;
    } catch {
      throw createError;
    }
  }

  return `${NATIVE_SHARE_DIRECTORY}/${safeFileName}`;
}

/**
 * Export text files in a platform-appropriate way.
 *
 * Android/iOS:
 * - writes to the app cache directory
 * - opens the native share sheet
 * - does not require broad storage permissions
 *
 * Web:
 * - falls back to a normal browser download
 */
export async function exportTextFile(options: TextFileExportOptions): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const path = await getNativeSharePath(options.fileName);
    const result = await Filesystem.writeFile({
      path,
      data: options.content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const canShare = await Share.canShare();
    if (!canShare.value) {
      throw new Error('Native sharing is unavailable on this device.');
    }

    await Share.share({
      title: options.shareTitle,
      files: [result.uri],
      dialogTitle: options.shareTitle,
    });
    return;
  }

  const blob = new Blob([options.content], {
    type: `${options.mimeType};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}


export interface BlobFileExportOptions {
  fileName: string;
  blob: Blob;
  shareTitle: string;
}

export async function exportBlobFile(options: BlobFileExportOptions): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const path = await getNativeSharePath(options.fileName);
    const bytes = new Uint8Array(await options.blob.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
    }
    const result = await Filesystem.writeFile({
      path,
      data: btoa(binary),
      directory: Directory.Cache,
    });
    const canShare = await Share.canShare();
    if (!canShare.value) throw new Error('Native sharing is unavailable on this device.');
    await Share.share({
      title: options.shareTitle,
      files: [result.uri],
      dialogTitle: options.shareTitle,
    });
    return;
  }

  const url = URL.createObjectURL(options.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
