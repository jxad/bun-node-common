import type { EventBus } from "../../event-bus/event-bus";
import { DomainValidationEvent } from "./domain-validation-event";
import type { ValidationError, ValidationResult } from "./models";

/**
 * Helper class to manage domain validation through event bus
 * Allows decoupling validation logic from domain entities
 */
export class DomainValidator {
  constructor(private eventBus: EventBus) {}

  /**
   * Validate using a custom validation event
   * Use this when you have specific validation event classes
   * 
   * @param event - Custom validation event instance
   * @returns ValidationResult with all errors aggregated
   */
  async validateWithEvent<TData, TEvent extends DomainValidationEvent<TData>>(
    event: TEvent
  ): Promise<ValidationResult> {
    const results = await this.eventBus.requestAll<TEvent, ValidationResult>(event);
    return this.aggregateResults(results);
  }

  /**
   * Helper to throw an error if validation fails using a custom event
   * Useful for domain entity creation/update flows
   */
  async validateOrThrowWithEvent<TData, TEvent extends DomainValidationEvent<TData>>(
    event: TEvent
  ): Promise<void> {
    const result = await this.validateWithEvent(event);
    
    if (!result.valid) {
      throw new DomainValidationError(
        `Validation failed for ${event.type} (${event.operation})`,
        result.errors
      );
    }
  }

  /**
   * Aggregate multiple validation results into a single result
   */
  private aggregateResults(results: ValidationResult[]): ValidationResult {
    if (results.length === 0) {
      return { valid: true, errors: [] };
    }

    const allErrors: ValidationError[] = [];
    let isValid = true;

    for (const result of results) {
      if (!result.valid) {
        isValid = false;
        allErrors.push(...result.errors);
      }
    }

    return {
      valid: isValid,
      errors: allErrors
    };
  }
}

/**
 * Error thrown when domain validation fails
 */
export class DomainValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationError[]
  ) {
    super(message);
    this.name = 'DomainValidationError';
    
    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainValidationError);
    }
  }

  /**
   * Get a formatted string of all validation errors
   */
  getErrorsFormatted(): string {
    return this.errors
      .map(err => `[${err.code}] ${err.message}`)
      .join('; ');
  }

  /**
   * Check if a specific error code exists
   */
  hasError(code: string): boolean {
    return this.errors.some(err => err.code === code);
  }
}

