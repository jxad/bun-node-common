# Domain Validation

Request-response event-based validation system for Domain-Driven Design (DDD).

## Features

- **Typed events**: Create specific events for each validation type
- **Decoupling**: Validations separated from domain entities
- **Aggregation**: Support for multiple validators with aggregated errors
- **Async**: Full support for async validations (DB, API calls)
- **Type-safe**: Full TypeScript support

## Usage

### 1. Create Specific Events

```typescript
import { DomainValidationEvent } from "./validation";

// Define your data types
interface PaymentData {
  amount: number;
  currency: string;
  userId: string;
}

// Event to validate payment creation
class CreatePaymentValidationEvent extends DomainValidationEvent<PaymentData> {
  constructor(paymentData: PaymentData, timeout?: number) {
    super("create", paymentData, timeout);
  }
}

// Define update data type
interface UpdateUserData {
  userId: string;
  email?: string;
  name?: string;
}

// Event to validate user update
class UpdateUserValidationEvent extends DomainValidationEvent<UpdateUserData> {
  constructor(userId: string, updates: { email?: string; name?: string }, timeout?: number) {
    super("update", { userId, ...updates }, timeout);
  }
}
```

### 2. Register Validators

```typescript
import { EventBus } from "../event-bus";
import { validationSuccess, validationError } from "./validation";

const eventBus = new EventBus();

// Register validator for CreatePaymentValidationEvent
eventBus.onRequest(CreatePaymentValidationEvent, async (event) => {
  // Type-safe access to event.data
  const { amount, currency } = event.data;
  
  if (amount <= 0) {
    return validationError("invalid_amount", "Amount must be positive");
  }
  
  if (!["EUR", "USD"].includes(currency)) {
    return validationError("invalid_currency", "Currency not supported");
  }
  
  return validationSuccess();
});

// Second validator for the same event (check limits)
eventBus.onRequest(CreatePaymentValidationEvent, async (event) => {
  const { userId, amount } = event.data;
  
  const dailyTotal = await getUserDailyPaymentTotal(userId);
  if (dailyTotal + amount > 10000) {
    return validationError("daily_limit_exceeded", "Daily limit exceeded");
  }
  
  return validationSuccess();
});
```

### 3. Use in Domain Entities

```typescript
import { DomainValidator } from "./validation";

class Payment {
  private constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly userId: string
  ) {}
  
  static async create(
    validator: DomainValidator,
    amount: number,
    currency: string,
    userId: string
  ): Promise<Payment> {
    // Create typed event with type-safe data
    const event = new CreatePaymentValidationEvent(
      { amount, currency, userId },
      5000 // 5 seconds timeout
    );
    
    // Validate - throws exception if fails
    await validator.validateOrThrowWithEvent(event);
    
    // Create entity
    return new Payment(generateId(), amount, currency, userId);
  }
}

class User {
  constructor(
    public readonly id: string,
    public email: string,
    public name: string
  ) {}
  
  async update(
    validator: DomainValidator,
    updates: { email?: string; name?: string }
  ): Promise<void> {
    const event = new UpdateUserValidationEvent(this.id, updates);
    
    // Validate and get result
    const result = await validator.validateWithEvent(event);
    
    if (!result.valid) {
      throw new Error(`Cannot update: ${result.errors.map(e => e.message).join(", ")}`);
    }
    
    // Apply updates
    if (updates.email) this.email = updates.email;
    if (updates.name) this.name = updates.name;
  }
}
```

### 4. Application Bootstrap

```typescript
import { EventBus } from "../event-bus";
import { DomainValidator } from "./validation";

// Register all validators at bootstrap
function bootstrapValidation(): DomainValidator {
  const eventBus = new EventBus();
  
  // Register payment validators
  registerPaymentValidators(eventBus);
  
  // Register user validators
  registerUserValidators(eventBus);
  
  return new DomainValidator(eventBus);
}

const validator = bootstrapValidation();

// Use in entities
const payment = await Payment.create(validator, 100, "EUR", "user-123");
```

## API

### DomainValidator

```typescript
class DomainValidator {
  // Validate using custom event (RECOMMENDED)
  validateWithEvent<TData, TEvent extends DomainValidationEvent<TData>>(
    event: TEvent
  ): Promise<ValidationResult>
  
  // Validate with custom event and throw if fails
  validateOrThrowWithEvent<TData, TEvent extends DomainValidationEvent<TData>>(
    event: TEvent
  ): Promise<void>
}
```

### DomainValidationEvent

```typescript
class DomainValidationEvent<TData> {
  readonly type: string;        // Auto-set to class name
  readonly operation: string;    // create, update, delete, etc.
  readonly data: TData;         // Type-safe data
  readonly timeout?: number;
  
  constructor(operation: string, data: TData, timeout?: number)
}
```

### DomainValidationError

```typescript
class DomainValidationError extends Error {
  readonly errors: ValidationError[];
  
  getErrorsFormatted(): string
  hasError(code: string): boolean
}
```

### Helper Functions

```typescript
// Create success result
validationSuccess(): ValidationResult

// Create result with single error
validationError(code: string, message: string, context?: Record<string, any>): ValidationResult

// Create result with multiple errors
validationErrors(errors: ValidationError[]): ValidationResult
```

### TypeScript Models

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  code: string;
  message: string;
  context?: Record<string, any>;
}

interface ValidationEventBase<TData> extends RequestEventBase<ValidationResult> {
  operation: string;
  data: TData;
}
```

## Common Patterns

### Validation with Multiple Errors

```typescript
import { validationErrors } from "./validation";

eventBus.onRequest(CreateUserValidationEvent, async (event) => {
  const errors: ValidationError[] = [];
  
  if (!event.data.email.includes("@")) {
    errors.push({
      code: "invalid_email",
      message: "Email format is invalid"
    });
  }
  
  if (event.data.age < 18) {
    errors.push({
      code: "age_too_young",
      message: "User must be at least 18 years old"
    });
  }
  
  return validationErrors(errors);
});
```

### Cross-Entity Validation

```typescript
eventBus.onRequest(CreateOrderValidationEvent, async (event) => {
  const { userId, items } = event.orderData;
  
  // Verify user
  const user = await db.users.findById(userId);
  if (!user) {
    return validationError("user_not_found", "User does not exist");
  }
  
  // Verify products
  for (const item of items) {
    const product = await db.products.findById(item.productId);
    if (!product || product.stock < item.quantity) {
      return validationError("insufficient_stock", "Product out of stock");
    }
  }
  
  return validationSuccess();
});
```

### Context for Debugging

```typescript
eventBus.onRequest(TransferFundsValidationEvent, async (event) => {
  const account = await getAccount(event.fromAccountId);
  
  if (account.balance < event.amount) {
    return validationError(
      "insufficient_funds",
      "Insufficient funds in account",
      {
        accountId: event.fromAccountId,
        balance: account.balance,
        required: event.amount
      }
    );
  }
  
  return validationSuccess();
});
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { EventBus } from "../event-bus";
import { DomainValidator, validationSuccess, validationError } from "./validation";

describe("Payment Validation", () => {
  let eventBus: EventBus;
  let validator: DomainValidator;
  
  beforeEach(() => {
    eventBus = new EventBus();
    validator = new DomainValidator(eventBus);
  });
  
  it("should reject invalid payments", async () => {
    eventBus.onRequest(CreatePaymentValidationEvent, async (event) => {
      if (event.data.amount <= 0) {
        return validationError("invalid_amount", "Amount must be positive");
      }
      return validationSuccess();
    });
    
    const event = new CreatePaymentValidationEvent({ amount: -100, currency: "EUR", userId: "u1" });
    const result = await validator.validateWithEvent(event);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("invalid_amount");
  });
});
```

## Code Organization

### Recommended Structure

```
domain/
  ├── validation/           # Validation system
  │   ├── index.ts
  │   ├── models.ts
  │   ├── domain-validator.ts
  │   └── helpers.ts
  ├── entities/            # Domain entities
  │   ├── payment.ts
  │   └── user.ts
  ├── events/              # Specific validation events
  │   ├── payment-events.ts
  │   └── user-events.ts
  └── validators/          # Validator registration
      ├── payment-validators.ts
      └── user-validators.ts
```

### Events File

```typescript
// domain/events/payment-events.ts
import { DomainValidationEvent } from "../validation";

export interface PaymentData {
  amount: number;
  currency: string;
  userId: string;
}

export class CreatePaymentValidationEvent extends DomainValidationEvent<PaymentData> {
  constructor(paymentData: PaymentData, timeout?: number) {
    super("create", paymentData, timeout);
  }
}
```

### Validators File

```typescript
// domain/validators/payment-validators.ts
import { EventBus } from "../../event-bus";
import { CreatePaymentValidationEvent } from "../events/payment-events";
import { validationError, validationSuccess } from "../validation";

export function registerPaymentValidators(eventBus: EventBus) {
  eventBus.onRequest(CreatePaymentValidationEvent, async (event) => {
    if (event.data.amount <= 0) {
      return validationError("invalid_amount", "Amount must be positive");
    }
    return validationSuccess();
  });
}
```
