import {
  Camera,
  MediaTypeSelection,
  type MediaResult,
  type PermissionStatus,
} from '@capacitor/camera';

export type PhotoAcquisitionSource = 'camera' | 'gallery';

export type PhotoAcquisitionErrorCode =
  | 'CAMERA_PERMISSION_REQUIRED'
  | 'GALLERY_PERMISSION_REQUIRED'
  | 'CAMERA_UNAVAILABLE'
  | 'PHOTO_ACQUISITION_FAILED';

export class PhotoAcquisitionError extends Error {
  constructor(
    public readonly code: PhotoAcquisitionErrorCode,
    message?: string
  ) {
    super(message || code);
    this.name = 'PhotoAcquisitionError';
  }
}

export interface AcquiredPhoto {
  previewUrl: string;
  filename: string;
  loadFile: () => Promise<File>;
}

const CANCELLATION_CODES = new Set([
  'OS-PLUG-CAMR-0006',
  'OS-PLUG-CAMR-0020',
]);

function nativeErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function nativeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return '';
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

function normalizeAcquisitionError(
  error: unknown,
  source: PhotoAcquisitionSource
): PhotoAcquisitionError | null {
  const code = nativeErrorCode(error);
  const message = nativeErrorMessage(error);

  if (CANCELLATION_CODES.has(code) || /cancel(?:led|ed)?/i.test(message)) {
    return null;
  }
  if (code === 'OS-PLUG-CAMR-0003') {
    return new PhotoAcquisitionError('CAMERA_PERMISSION_REQUIRED', message);
  }
  if (code === 'OS-PLUG-CAMR-0005') {
    return new PhotoAcquisitionError('GALLERY_PERMISSION_REQUIRED', message);
  }
  if (code === 'OS-PLUG-CAMR-0007') {
    return new PhotoAcquisitionError('CAMERA_UNAVAILABLE', message);
  }
  return new PhotoAcquisitionError(
    'PHOTO_ACQUISITION_FAILED',
    message || (source === 'camera' ? 'Unable to take photo.' : 'Unable to choose photo.')
  );
}

async function ensureCameraPermission(): Promise<void> {
  let status: PermissionStatus = await Camera.checkPermissions();
  if (status.camera === 'granted') return;

  status = await Camera.requestPermissions({ permissions: ['camera'] });
  if (status.camera !== 'granted') {
    throw new PhotoAcquisitionError('CAMERA_PERMISSION_REQUIRED');
  }
}

function filenameFromResult(result: MediaResult, index: number): string {
  const source = result.uri || result.webPath || '';
  const clean = source.split(/[?#]/, 1)[0];
  const last = clean.split('/').pop();
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return `photo-${Date.now()}-${index + 1}.jpg`;
}

function toAcquiredPhoto(result: MediaResult, index: number): AcquiredPhoto {
  const previewUrl = result.webPath;
  if (!previewUrl) {
    throw new PhotoAcquisitionError('PHOTO_ACQUISITION_FAILED', 'Photo path is unavailable.');
  }

  const filename = filenameFromResult(result, index);

  return {
    previewUrl,
    filename,
    loadFile: async () => {
      const response = await fetch(previewUrl);
      if (!response.ok) {
        throw new PhotoAcquisitionError('PHOTO_ACQUISITION_FAILED', 'Photo could not be read.');
      }
      const blob = await response.blob();
      if (blob.size <= 0) {
        throw new PhotoAcquisitionError('PHOTO_ACQUISITION_FAILED', 'Photo is empty.');
      }
      const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      return new File([blob], filename, {
        type: mimeType,
        lastModified: Date.now(),
      });
    },
  };
}

export async function takePhoto(): Promise<AcquiredPhoto | null> {
  try {
    await ensureCameraPermission();
    const result = await Camera.takePhoto({
      quality: 100,
      saveToGallery: false,
      editable: 'no',
      includeMetadata: false,
      webUseInput: true,
    });
    return toAcquiredPhoto(result, 0);
  } catch (error) {
    if (error instanceof PhotoAcquisitionError) throw error;
    const normalized = normalizeAcquisitionError(error, 'camera');
    if (!normalized) return null;
    throw normalized;
  }
}

export async function choosePhotos(limit = 1): Promise<AcquiredPhoto[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  try {
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: safeLimit > 1,
      limit: safeLimit,
      quality: 100,
      editable: 'no',
      includeMetadata: false,
    });
    return results.slice(0, safeLimit).map(toAcquiredPhoto);
  } catch (error) {
    const normalized = normalizeAcquisitionError(error, 'gallery');
    if (!normalized) return [];
    throw normalized;
  }
}

export async function waitForPhotoUiPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 0);
      });
    });
  });
}
