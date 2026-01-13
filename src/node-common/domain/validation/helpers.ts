import type { ValidationResult, ValidationError } from "./models";

/**
 * Helper to create validation success result
 */
export function validationSuccess(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Helper to create validation error result
 */
export function validationError(code: string, message: string, context?: Record<string, any>): ValidationResult {
  return {
    valid: false,
    errors: [{ code, message, context }]
  };
}

/**
 * Helper to create validation result with multiple errors
 */
export function validationErrors(errors: ValidationError[]): ValidationResult {
  return {
    valid: errors.length === 0,
    errors
  };
}

