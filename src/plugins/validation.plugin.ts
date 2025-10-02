import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z, ZodError } from 'zod';

// Custom error class for validation errors
export class ValidationError extends Error {
  public statusCode: number;
  public code: string;
  public field?: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR', field?: string) {
    super(message);
    this.statusCode = 400;
    this.code = code;
    this.field = field;
    this.name = 'ValidationError';
  }
}

// Validation hook factory
export function createValidationHook<TBody = any, TQuery = any, TParams = any>(schemas: {
  body?: z.ZodSchema<TBody>;
  querystring?: z.ZodSchema<TQuery>;
  params?: z.ZodSchema<TParams>;
}) {
  return async function validationHook(
    request: FastifyRequest<{
      Body: TBody;
      Querystring: TQuery;
      Params: TParams;
    }>
    // reply: FastifyReply
  ) {
    try {
      // Validate body if schema provided
      if (schemas.body && request.body) {
        request.body = schemas.body.parse(request.body);
      }

      // Validate querystring if schema provided
      if (schemas.querystring && request.query) {
        (request.query as any) = schemas.querystring.parse(request.query);
      }

      // Validate params if schema provided
      if (schemas.params && request.params) {
        (request.params as any) = schemas.params.parse(request.params);
      }
    } catch (error: any) {
      request.log.error('Validation error:', error);

      if (error instanceof ZodError && error.issues && error.issues.length > 0) {
        const firstError = error.issues[0];

        // Map Zod error messages to our API error codes
        let errorCode = 'INVALID_REQUEST';
        const message = firstError.message;

        // Map specific error messages to proper error codes
        if (message.includes('Height') && message.includes('required')) {
          errorCode = 'MISSING_HEIGHT';
        } else if (
          message.includes('Height') &&
          (message.includes('non-negative') || message.includes('positive'))
        ) {
          errorCode = 'INVALID_HEIGHT';
        } else if (message.includes('Block height')) {
          errorCode = 'INVALID_HEIGHT';
        } else if (message.includes('Address') && message.includes('required')) {
          errorCode = 'INVALID_ADDRESS';
        }

        throw new ValidationError(
          firstError.message,
          errorCode,
          firstError.path ? firstError.path.join('.') : ''
        );
      }

      // Handle other types of errors
      throw new ValidationError('Invalid request data', 'INVALID_REQUEST');
    }
  };
}

// Special rollback validation that handles the missing height case properly
export async function validateRollbackQuery(
  request: FastifyRequest<{ Querystring: { height: number } }>
  // reply: FastifyReply
) {
  // Check if height parameter exists at all
  const rawQuery = request.query as any;
  if (!rawQuery || !('height' in rawQuery)) {
    throw new ValidationError('Height query parameter is required', 'MISSING_HEIGHT');
  }

  const heightValue = rawQuery.height as string;

  // Check if height is a valid number
  if (!heightValue || isNaN(Number(heightValue))) {
    throw new ValidationError('Height must be a non-negative integer', 'INVALID_HEIGHT');
  }

  const numericHeight = Number(heightValue);

  // Check if height is non-negative
  if (numericHeight < 0) {
    throw new ValidationError('Height must be a non-negative integer', 'INVALID_HEIGHT');
  }

  // Add the parsed height to the query
  (request.query as any).height = numericHeight;
}

// Plugin to register validation utilities
const validationPlugin: FastifyPluginAsync = async fastify => {
  fastify.decorate('createValidationHook', createValidationHook);
  fastify.decorate('validateRollbackQuery', validateRollbackQuery);
};

export default fp(validationPlugin, {
  name: 'validation-plugin'
});

declare module 'fastify' {
  // eslint-disable-next-line no-unused-vars
  interface FastifyInstance {
    createValidationHook: typeof createValidationHook;
    validateRollbackQuery: typeof validateRollbackQuery;
  }
}
