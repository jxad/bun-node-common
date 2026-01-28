# Event Bus

Event bus built on top of Node.js/Bun `EventEmitter` with typed request-response support.

## Features

- **Built on EventEmitter**: Leverages the battle-tested native implementation
- **Classic Publish/Subscribe**: Fire-and-forget events with multiple listeners
- **Request/Response (single)**: Events that await a single handler's response
- **Request/Response (multi)**: Aggregation pattern with multiple handlers (e.g., validation)
- **Async Support**: Handlers can be sync or async
- **Timeout with cleanup**: Proper timer cleanup to avoid memory leaks
- **Type-safe**: Full TypeScript support

## Basic Usage

### Publish/Subscribe (Fire-and-forget)

```typescript
import { EventBus, EventBusEventBase } from "./event-bus";

const eventBus = new EventBus();

// Define an event
class UserCreatedEvent implements EventBusEventBase {
  type = UserCreatedEvent.name;

  constructor(public userId: string, public email: string) {}
}

// Register multiple subscribers (allowed)
eventBus.subscribe(UserCreatedEvent, (event) => {
  console.log(`User created: ${event.email}`);
});

eventBus.subscribe(UserCreatedEvent, (event) => {
  sendWelcomeEmail(event.email);
});

// Publish the event - all subscribers are notified
eventBus.publish(new UserCreatedEvent("123", "user@example.com"));
```

### Request/Response (Single Handler)

For classic request-response where exactly one handler responds:

```typescript
import { EventBus, RequestEventBase } from "./event-bus";

// Define a request-response event
class GetUserEvent implements RequestEventBase<User> {
  type = GetUserEvent.name;

  constructor(
    public userId: string,
    public timeout?: number
  ) {}
}

// Register a single handler (only one allowed!)
eventBus.onRequest(GetUserEvent, async (event) => {
  return await db.findUser(event.userId);
});

// This would throw: "Handler already registered for event type: GetUserEvent"
// eventBus.onRequest(GetUserEvent, anotherHandler);

// Send request and await response
const user = await eventBus.request(new GetUserEvent("user-123", 5000));
```

### Request/Response (Multiple Handlers)

For aggregation patterns like validation where multiple handlers contribute:

```typescript
import { EventBus, RequestEventBase } from "./event-bus";
import { ValidationResult } from "./models";

// Define a validation event
class ValidateUserEvent implements RequestEventBase<ValidationResult> {
  type = ValidateUserEvent.name;

  constructor(
    public data: UserData,
    public timeout?: number
  ) {}
}

// Register multiple validators (allowed with onRequestMulti)
eventBus.onRequestMulti(ValidateUserEvent, async (event) => {
  if (!event.data.email.includes("@")) {
    return { valid: false, errors: [{ code: "invalid_email", message: "Invalid email" }] };
  }
  return { valid: true, errors: [] };
});

eventBus.onRequestMulti(ValidateUserEvent, async (event) => {
  if (event.data.name.length < 2) {
    return { valid: false, errors: [{ code: "name_too_short", message: "Name too short" }] };
  }
  return { valid: true, errors: [] };
});

// Get responses from ALL handlers
const results = await eventBus.requestAll(new ValidateUserEvent(userData));
// results: ValidationResult[] - array of all responses to aggregate
```

## API

### EventBus (extends EventEmitter)

#### subscribe<T>(eventClass, listener)
Registers a listener for classic publish/subscribe events. Multiple listeners allowed.

#### unsubscribe<T>(eventClass, listener)
Removes a listener.

#### publish<T>(event)
Publishes an event to all subscribers.

---

#### onRequest<T, R>(eventClass, handler)
Registers a handler for single-handler request-response. **Only ONE handler allowed**.

```typescript
eventBus.onRequest(MyRequestEvent, async (event) => {
  return result;
});
// Throws if called again for the same event type!
```

#### offRequest<T, R>(eventClass, handler)
Removes a single-handler request handler.

#### request<T, R>(event): Promise<R>
Sends a request and awaits the response from the single registered handler.

- Returns the handler's response
- Throws if no handler is registered
- Supports timeout via `event.timeout`

#### hasRequestHandler<T>(eventClass): boolean
Checks if a single-handler is registered for a request event type.

---

#### onRequestMulti<T, R>(eventClass, handler)
Registers a handler for multi-handler request-response. **Multiple handlers allowed**.

```typescript
eventBus.onRequestMulti(ValidateEvent, validator1);
eventBus.onRequestMulti(ValidateEvent, validator2); // OK!
```

#### offRequestMulti<T, R>(eventClass, handler)
Removes a multi-handler request handler.

#### requestAll<T, R>(event): Promise<R[]>
Sends a request and awaits responses from ALL registered handlers.

- Returns array of all responses
- Returns empty array if no handlers registered
- Supports timeout via `event.timeout`

#### hasRequestMultiHandlers<T>(eventClass): boolean
Checks if any multi-handlers are registered for a request event type.

#### getRequestMultiHandlerCount<T>(eventClass): number
Returns the number of multi-handlers registered for a request event type.

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

## Common Patterns

### Timeout with Proper Cleanup

```typescript
const event = new MyRequestEvent(data);
event.timeout = 5000; // 5 seconds

try {
  const result = await eventBus.request(event);
} catch (error) {
  // Error: Request timeout after 5000ms for event type: MyRequestEvent
}
// Timer is properly cleaned up whether request succeeds, fails, or times out
```

### Handler Cleanup

```typescript
const handler = async (event: MyEvent) => { /* ... */ };

eventBus.onRequestMulti(MyEvent, handler);

// When no longer needed
eventBus.offRequestMulti(MyEvent, handler);
```

### Conditional Request

```typescript
if (eventBus.hasRequestHandler(GetUserEvent)) {
  const user = await eventBus.request(new GetUserEvent(userId));
}
```

## Single vs Multi Handler: When to Use

| Use Case | API | Rationale |
|----------|-----|-----------|
| Query (get data) | `onRequest`/`request` | Single source of truth |
| Command (execute action) | `onRequest`/`request` | Single executor |
| Validation | `onRequestMulti`/`requestAll` | Aggregate validators |
| Authorization | `onRequestMulti`/`requestAll` | Multiple policies |

## Integration with Domain Validation

For a complete domain validation system using `onRequestMulti`/`requestAll`, see [Domain Validation](../domain/validation/README.md).
