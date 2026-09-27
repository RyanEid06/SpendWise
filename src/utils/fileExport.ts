import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface TextFileExportOptions {
  fileName: string;
  content: string;
  mimeType: string;
  shareTitle: string;
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
    const result = await Filesystem.writeFile({
      path: options.fileName,
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
