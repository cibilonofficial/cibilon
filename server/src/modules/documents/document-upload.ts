import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors.js';
import { ALLOWED_DOCUMENT_MIME_TYPES } from './file-validation.js';

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_DOCUMENT_SIZE_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype as never)) {
      callback(new AppError(422, 'INVALID_DOCUMENT_TYPE', 'Only PDF, JPG, and PNG files are accepted'));
      return;
    }
    callback(null, true);
  },
});
