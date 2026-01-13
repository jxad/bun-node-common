# Event Bus

Event bus system with request-response support for asynchronous communication between components.

## Features

- **Classic Publish/Subscribe**: Fire-and-forget events
- **Request/Response**: Events that await responses from handlers
- **Async Support**: Handlers can be sync or async
- **Response Aggregation**: Collects responses from all handlers
- **Timeout**: Support for request timeouts
- **Type-safe**: Full TypeScript support

## Basic Usage

### Publish/Subscribe (Fire-and-forget)

```typescript
import { EventBus } from "./event-bus";

const eventBus = new EventBus();

// Define an event
class UserCreatedEvent implements EventBusEventBase {
  type = UserCreatedEvent.name;

  constructor(public userId: string, public email: string) {}
}

// Register a subscriber
eventBus.subscribe(UserCreatedEvent, (event) => {
  console.log(`User created: ${event.email}`);
});

// Publish the event
eventBus.publish(new UserCreatedEvent("123", "user@example.com"));
```

### Request/Response

```typescript
import { RequestEventBase, ValidationResult } from "./models";

// Define a request-response event
class ValidateEmailEvent implements RequestEventBase<boolean> {
  type = ValidateEmailEvent.name;

  constructor(
    public email: string,
    public timeout?: number
  ) {}
}

// Register a handler that returns a response
eventBus.onRequest(ValidateEmailEvent, async (event) => {
  const exists = await checkEmailExists(event.email);
  return !exists; // true if valid
});

// Send request and await response
const event = new ValidateEmailEvent("test@example.com", 5000);
const results = await eventBus.request(event);
// results is an array of all responses

// Or get only the first response
const isValid = await eventBus.requestFirst(event);
```

## API

### EventBus

#### subscribe<T>(eventClass, listener)
Registers a listener for classic publish/subscribe events.

```typescript
eventBus.subscribe(MyEvent, (event) => {
  // handle event
});
```

#### unsubscribe<T>(eventClass, listener)
Removes a listener.

#### publish<T>(event)
Publishes an event to all subscribers.

#### onRequest<T, R>(eventClass, handler)
Registers a handler for request-response events.

```typescript
eventBus.onRequest(MyRequestEvent, async (event) => {
  // process request
  return result;
});
```

#### offRequest<T, R>(eventClass, handler)
Removes a request-response handler.

#### request<T, R>(event): Promise<R[]>
Sends a request and awaits responses from all handlers.

- Returns array of all responses
- Supports timeout via `event.timeout`
- Returns empty array if no handler is registered

#### requestFirst<T, R>(event): Promise<R>
Sends a request and awaits the first response.

- Returns only the first response
- Throws error if no handler is registered
- Supports timeout via `event.timeout`

## Types

### EventBusEventBase
Base interface for publish/subscribe events.

```typescript
interface EventBusEventBase {
  type: string;
}
```

### RequestEventBase<TResponse>
Base interface for request-response events.

```typescript
interface RequestEventBase<TResponse = any> extends EventBusEventBase {
  timeout?: number;
}
```

### ValidationEventBase
Interface for validation events (extends RequestEventBase).

```typescript
interface ValidationEventBase extends RequestEventBase<ValidationResult> {
  entityType: string;
  operation: string;
  data: any;
}
```

### ValidationResult
Result of a validation.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

### ValidationError
Details of a validation error.

```typescript
interface ValidationError {
  code: string;
  message: string;
  context?: Record<string, any>;
}
```

## Common Patterns

### Multiple Handlers with Aggregation

```typescript
// Handler 1
eventBus.onRequest(ValidateUserEvent, async (event) => {
  if (!isValidEmail(event.data.email)) {
    return validationError("invalid_email", "Invalid email");
  }
  return validationSuccess();
});

// Handler 2
eventBus.onRequest(ValidateUserEvent, async (event) => {
  const exists = await db.findByEmail(event.data.email);
  if (exists) {
    return validationError("email_exists", "Email already exists");
  }
  return validationSuccess();
});

// Send request - all handlers are executed
const results = await eventBus.request(new ValidateUserEvent({...}));
```

### Timeout

```typescript
const event = new MyRequestEvent(data, 5000); // 5 seconds timeout
try {
  const results = await eventBus.request(event);
} catch (error) {
  // Error: Request timeout after 5000ms for event type: MyRequestEvent
}
```

### Handler Cleanup

```typescript
const handler = async (event) => { /* ... */ };

eventBus.onRequest(MyEvent, handler);

// When no longer needed
eventBus.offRequest(MyEvent, handler);
```

## Integration with Domain Validation

For a complete domain validation system, see [Domain Validation](../domain/validation/README.md).
