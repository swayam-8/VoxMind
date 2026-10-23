import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './requestLogger.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.message,
      code: err.code,
      errors: err.details || null,
      data: null,
    });
  }

  if (err instanceof ZodError) {
    const errorMap: Record<string, string[]> = {};
    for (const e of err.errors) {
      const field = e.path.join('.') || 'body';
      if (!errorMap[field]) errorMap[field] = [];
      errorMap[field].push(e.message);
    }
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errorMap,
      data: null,
    });
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: err.message,
      code: 'UPLOAD_ERROR',
      errors: null,
      data: null,
    });
  }

  logger.error({ err, url: req.path, method: req.method }, 'Unhandled Exception');

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
    code: 'INTERNAL_ERROR',
    errors: null,
    data: null,
  });
}
