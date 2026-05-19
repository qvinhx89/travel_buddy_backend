import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Schemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) {
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
    next();
  };
}
