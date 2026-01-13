import type { RequestEventBase } from "../../event-bus/models";

/** Validation error details */
export interface ValidationError {
  /** Error code or field name */
  code: string;
  /** Human readable error message */
  message: string;
  /** Optional additional context */
  context?: Record<string, any>;
}

/** Result of a validation request */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors if any */
  errors: ValidationError[];
}

/** Base event for validation requests */
export interface ValidationEventBase<TData> extends RequestEventBase<ValidationResult> {
  /** Validation operation (create, update, delete, etc) */
  operation: string;
  /** Entity data being validated */
  data: TData;
}

