# Logger Module

Structured logging module built on Winston with Seq integration and distributed tracing support.

## Features

- Winston-based structured logging
- Seq transport for centralized log aggregation
- Distributed tracing with trace context propagation
- Scoped loggers for different components
- Request tracing middleware for HTTP servers

## Usage

### Basic Setup

```typescript
import { LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341",
  seqApiKey: "your-api-key", // optional
  logLevel: "info" // trace | debug | info | warn | error
});

// Get a scoped logger
const logger = loggerFactory.current("MyService");
```

### Logging Methods

```typescript
// Information logs
logger.info("User logged in", { userId: 123 });

// Debug logs (only shown when logLevel is "debug" or lower)
logger.debug("Processing request", { requestId: "abc" });

// Trace logs (most verbose)
logger.trace("Entering function", { args: ["foo", "bar"] });

// Warnings
logger.warn("Rate limit approaching", { current: 95, max: 100 });

// Errors (requires Error object)
logger.error("Database connection failed", new Error("Connection refused"), {
  host: "db.example.com",
  port: 5432
});
```

### Class-based Logging

```typescript
class UserService {
  private readonly logger: ScopedLogger;

  constructor(loggerFactory: LoggerFactory) {
    // Automatically uses class name as scope
    this.logger = loggerFactory.forClass(this);
  }

  async getUser(id: string) {
    this.logger.info("Fetching user", { id });
    // ...
  }
}
```

### Request Tracing

The `RequestTracingMiddleware` automatically adds trace context to all logs within an HTTP request:

```typescript
import { LoggerFactory, RequestTracingMiddleware } from "bun-node-common";

const tracingMiddleware = new RequestTracingMiddleware(
  loggerFactory,
  loggerFactory.getTraceContextStore()
);

// All logs within the request context will include:
// - traceId: unique identifier for the request chain
// - spanId: identifier for this specific operation
// - parentSpanId: parent operation (for distributed tracing)
```

### Tracing Propagation

When making outbound HTTP calls, use `TracingPropagator` to forward trace headers:

```typescript
import { TracingPropagator } from "bun-node-common";

const propagator = new TracingPropagator(loggerFactory.getTraceContextStore());

// Get headers to add to outbound requests
const headers = propagator.buildOutboundHeaders();
// { "x-trace-id": "...", "x-span-id": "...", "x-parent-span-id": "..." }
```

## Log Levels

| Level | Description |
|-------|-------------|
| `trace` | Most verbose, for detailed debugging |
| `debug` | Debug information |
| `info` | General operational information |
| `warn` | Warning conditions |
| `error` | Error conditions |

## Seq Integration

When `seqApiKey` is provided, logs are automatically sent to your Seq server with:

- Structured properties searchable in Seq
- Automatic exception handling
- Application and instance metadata

## Interfaces

```typescript
interface ScopedLogger {
  trace(message: string, data?: any): void;
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, err: Error, data?: any): void;
}

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}
```
