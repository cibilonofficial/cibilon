import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../common/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON', requestId: req.id } });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the configured size limit', requestId: req.id } });
      return;
    }
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 422).json({
      error: {
        code: tooLarge ? 'DOCUMENT_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooLarge ? 'Document exceeds the configured size limit' : error.message,
        requestId: req.id,
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId: req.id,
      },
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with the supplied unique value already exists',
        requestId: req.id,
      },
    });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found', requestId: req.id } });
    return;
  }

  req.log.error({ err: error, requestId: req.id }, 'Unhandled request error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id,
    },
  });
};
