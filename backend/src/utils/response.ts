import { Response } from 'express';

export interface MetaPagination {
  page?: number;
  per_page?: number;
  total?: number;
  pages?: number;
}

export function apiSuccess<T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: MetaPagination | Record<string, any>
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function apiError(
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  code: string = 'ERROR',
  errors?: any
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
    code,
    errors: errors || {},
    data: null,
  });
}
