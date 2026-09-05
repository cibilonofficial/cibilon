import path from 'node:path';
import { AppError } from '../../common/errors.js';

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

const extensionByMime: Record<(typeof ALLOWED_DOCUMENT_MIME_TYPES)[number], string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function detectedMimeType(buffer: Buffer): (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number] | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  return null;
}

export function validateDocumentFile(file: Express.Multer.File) {
  const detected = detectedMimeType(file.buffer);
  if (!detected || detected !== file.mimetype) {
    throw new AppError(
      422,
      'INVALID_DOCUMENT_CONTENT',
      'File content does not match an allowed PDF, JPG, or PNG type',
    );
  }
  return { mimeType: detected, extension: extensionByMime[detected] };
}

export function safeOriginalName(name: string) {
  const base = path.basename(name).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!base) throw new AppError(422, 'INVALID_FILE_NAME', 'A valid file name is required');
  return base.slice(0, 255);
}
