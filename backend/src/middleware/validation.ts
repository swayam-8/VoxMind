import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export function validateRequest(schema: {
  body?: ZodType<any>;
  query?: ZodType<any>;
  params?: ZodType<any>;
}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
