/**
 * Domain validation system tests
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { EventBus } from "../../event-bus";
import {
  DomainValidationError,
  DomainValidationEvent,
  DomainValidator,
  validationError,
  validationSuccess
} from "./index";

// Typed events for tests
interface UserData {
  name: string;
  email: string;
}

class CreateUserValidationEvent extends DomainValidationEvent<UserData> {
  constructor(userData: UserData, timeout?: number) {
    super("create", userData, timeout);
  }
}

interface UpdateUserData {
  userId: string;
  email?: string;
}

class UpdateUserValidationEvent extends DomainValidationEvent<UpdateUserData> {
  constructor(userId: string, updates: { email?: string }, timeout?: number) {
    super("update", { userId, ...updates }, timeout);
  }
}

interface DeleteOrderData {
  orderId: string;
}

class DeleteOrderValidationEvent extends DomainValidationEvent<DeleteOrderData> {
  constructor(orderId: string, timeout?: number) {
    super("delete", { orderId }, timeout);
  }
}

interface PaymentData {
  amount: number;
  currency: string;
}

class CreatePaymentValidationEvent extends DomainValidationEvent<PaymentData> {
  constructor(paymentData: PaymentData, timeout?: number) {
    super("create", paymentData, timeout);
  }
}

describe("DomainValidator", () => {
  let eventBus: EventBus;
  let validator: DomainValidator;

  beforeEach(() => {
    eventBus = new EventBus();
    validator = new DomainValidator(eventBus);
  });

  it("should pass validation when no handlers are registered", async () => {
    const event = new CreateUserValidationEvent({ name: "Test", email: "test@example.com" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should collect validation error from single handler", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async (event: CreateUserValidationEvent) => {
      if (!event.data.email.includes("@")) {
        return validationError("invalid_email", "Email format is invalid");
      }
      return validationSuccess();
    });

    const event = new CreateUserValidationEvent({ name: "Test", email: "invalid" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("invalid_email");
    expect(result.errors[0].message).toBe("Email format is invalid");
  });

  it("should aggregate errors from multiple handlers", async () => {
    // Handler 1
    eventBus.onRequestMulti(CreateUserValidationEvent, async (event: CreateUserValidationEvent) => {
      if (!event.data.email.includes("@")) {
        return validationError("invalid_email", "Email format is invalid");
      }
      return validationSuccess();
    });

    // Handler 2
    eventBus.onRequestMulti(CreateUserValidationEvent, async (event: CreateUserValidationEvent) => {
      if (event.data.name.length < 2) {
        return validationError("name_too_short", "Name must be at least 2 characters");
      }
      return validationSuccess();
    });

    const event = new CreateUserValidationEvent({ name: "X", email: "invalid" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].code).toBe("invalid_email");
    expect(result.errors[1].code).toBe("name_too_short");
  });

  it("should pass when all handlers return success", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationSuccess());
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationSuccess());

    const event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should throw DomainValidationError when using validateOrThrowWithEvent", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async (event: CreateUserValidationEvent) => {
      if (!event.data.email.includes("@")) {
        return validationError("invalid_email", "Email format is invalid");
      }
      return validationSuccess();
    });

    const event = new CreateUserValidationEvent({ name: "Test", email: "invalid" });

    await expect(
      validator.validateOrThrowWithEvent(event)
    ).rejects.toThrow(DomainValidationError);
  });

  it("should not throw when validation passes with validateOrThrowWithEvent", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationSuccess());

    const event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });

    await expect(
      validator.validateOrThrowWithEvent(event)
    ).resolves.toBeUndefined();
  });

  it("should support typed events with type-safe data access", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async (event: CreateUserValidationEvent) => {
      if (!event.data.email.includes("@")) {
        return validationError("invalid_email", "Email format is invalid");
      }
      return validationSuccess();
    });

    const event = new CreateUserValidationEvent({ name: "Test", email: "invalid" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("invalid_email");
  });

  it("should support update events with typed data", async () => {
    eventBus.onRequestMulti(UpdateUserValidationEvent, async (event: UpdateUserValidationEvent) => {
      if (event.data.email && !event.data.email.includes("@")) {
        return validationError("invalid_email", "Email format is invalid");
      }
      return validationSuccess();
    });

    const event = new UpdateUserValidationEvent("user-123", { email: "invalid" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("invalid_email");
  });

  it("should support delete events with typed data", async () => {
    eventBus.onRequestMulti(DeleteOrderValidationEvent, async (event: DeleteOrderValidationEvent) => {
      if (event.data.orderId === "shipped-order") {
        return validationError("cannot_delete", "Cannot delete shipped order");
      }
      return validationSuccess();
    });

    const event = new DeleteOrderValidationEvent("shipped-order");
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("cannot_delete");
  });

  it("should include context in validation errors", async () => {
    eventBus.onRequestMulti(CreatePaymentValidationEvent, async (event: CreatePaymentValidationEvent) => {
      if (event.data.amount <= 0) {
        return validationError("invalid_amount", "Amount must be positive", { 
          amount: event.data.amount 
        });
      }
      return validationSuccess();
    });

    const event = new CreatePaymentValidationEvent({ amount: -100, currency: "EUR" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.errors[0].context).toEqual({ amount: -100 });
  });

  it("should support custom validation events that extend DomainValidationEvent", async () => {
    // Register handler for specific event
    eventBus.onRequestMulti(CreatePaymentValidationEvent, async (event: CreatePaymentValidationEvent) => {
      if (event.data.amount <= 0) {
        return validationError("invalid_amount", "Amount must be positive");
      }
      if (!["EUR", "USD"].includes(event.data.currency)) {
        return validationError("invalid_currency", "Currency not supported");
      }
      return validationSuccess();
    });

    // Valid payment
    const validEvent = new CreatePaymentValidationEvent({ amount: 100, currency: "EUR" });
    const validResult = await validator.validateWithEvent(validEvent);
    expect(validResult.valid).toBe(true);

    // Invalid amount
    const invalidAmountEvent = new CreatePaymentValidationEvent({ amount: -10, currency: "EUR" });
    const invalidAmountResult = await validator.validateWithEvent(invalidAmountEvent);
    expect(invalidAmountResult.valid).toBe(false);
    expect(invalidAmountResult.errors[0].code).toBe("invalid_amount");

    // Invalid currency
    const invalidCurrencyEvent = new CreatePaymentValidationEvent({ amount: 100, currency: "JPY" });
    const invalidCurrencyResult = await validator.validateWithEvent(invalidCurrencyEvent);
    expect(invalidCurrencyResult.valid).toBe(false);
    expect(invalidCurrencyResult.errors[0].code).toBe("invalid_currency");
  });

  it("should have type-safe access to event data properties", async () => {
    eventBus.onRequestMulti(CreatePaymentValidationEvent, async (event: CreatePaymentValidationEvent) => {
      // TypeScript should allow accessing data properties with full type safety
      const amount = event.data.amount;
      const currency = event.data.currency;
      
      expect(typeof amount).toBe("number");
      expect(typeof currency).toBe("string");
      
      return validationSuccess();
    });

    const event = new CreatePaymentValidationEvent({ amount: 100, currency: "EUR" });
    await validator.validateWithEvent(event);
  });
});

describe("DomainValidationError", () => {
  it("should format errors correctly", () => {
    const error = new DomainValidationError("Test", [
      { code: "error1", message: "First error" },
      { code: "error2", message: "Second error" }
    ]);

    const formatted = error.getErrorsFormatted();
    expect(formatted).toBe("[error1] First error; [error2] Second error");
  });

  it("should check for specific error codes", () => {
    const error = new DomainValidationError("Test", [
      { code: "error1", message: "First error" },
      { code: "error2", message: "Second error" }
    ]);

    expect(error.hasError("error1")).toBe(true);
    expect(error.hasError("error2")).toBe(true);
    expect(error.hasError("error3")).toBe(false);
  });
});

describe("EventBus request-response with typed events", () => {
  let eventBus: EventBus;
  let validator: DomainValidator;

  beforeEach(() => {
    eventBus = new EventBus();
    validator = new DomainValidator(eventBus);
  });

  it("should handle request with single handler", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationSuccess());

    const event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(true);
  });

  it("should handle request with multiple handlers", async () => {
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationSuccess());
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationError("e1", "Error 1"));
    eventBus.onRequestMulti(CreateUserValidationEvent, async () => validationError("e2", "Error 2"));

    const event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("should support handler removal", async () => {
    const handler = async () => validationSuccess();
    
    eventBus.onRequestMulti(CreateUserValidationEvent, handler);
    let event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });
    let result = await validator.validateWithEvent(event);
    expect(result.valid).toBe(true);
    
    eventBus.offRequestMulti(CreateUserValidationEvent, handler);
    event = new CreateUserValidationEvent({ name: "John", email: "john@example.com" });
    result = await validator.validateWithEvent(event);
    expect(result.valid).toBe(true); // No handlers = success
  });
});

