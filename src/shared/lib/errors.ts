import type { PostgrestError } from '@supabase/supabase-js';

// Domain error classes for structured error handling
export class ConflictError extends Error {
  constructor(message: string = 'Resource was modified by another user') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Invalid input') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export type AppError = ConflictError | ForbiddenError | ValidationError | NotFoundError | AuthError;

/**
 * Maps a Supabase error to a domain error.
 * Usage: throw mapSupabaseError(error);
 */
export function mapSupabaseError(error: PostgrestError | Error | null): AppError {
  if (!error) return new ConflictError('Unknown error');

  const message = error.message || 'An unexpected error occurred';

  // Conflict / row version mismatch
  if (message.includes('Conflict') || message.includes('row_version')) {
    return new ConflictError(message);
  }

  // Permission errors
  if (message.includes('permission denied') || message.includes('permission denied for')
    || message.includes('violates row-level security') || message.includes('new row violates')) {
    return new ForbiddenError(message);
  }

  // Not found
  if (message.includes('not found') || message.includes('does not exist')) {
    return new NotFoundError(message);
  }

  // Auth errors
  if (message.includes('not authenticated') || message.includes('JWT')) {
    return new AuthError(message);
  }

  // Validation errors from RPCs
  if (message.includes('must be') || message.includes('cannot') || message.includes('already')) {
    return new ValidationError(message);
  }

  return new ValidationError(message);
}

/**
 * Safely get error message for display
 */
export function getErrorMessage(error: unknown, fallback: string = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}