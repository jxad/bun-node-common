import type { ValidationEventBase } from "./models";

/**
 * Base class for domain validation events
 * Extend this class to create specific validation events
 * 
 * @example
 * interface PaymentData {
 *   amount: number;
 *   currency: string;
 * }
 * 
 * class CreatePaymentValidationEvent extends DomainValidationEvent<PaymentData> {
 *   constructor(paymentData: PaymentData, timeout?: number) {
 *     super("create", paymentData, timeout);
 *   }
 * }
 */
export class DomainValidationEvent<TData> implements ValidationEventBase<TData> {
  readonly type: string;
  
  constructor(
    public readonly operation: string,
    public readonly data: TData,
    public readonly timeout?: number
  ) {
    // Use the actual class name for type to support inheritance
    this.type = this.constructor.name;
  }
}

