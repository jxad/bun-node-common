# bun-node-common

A collection of useful building blocks for backend services built with **Bun.js**. This library provides production-ready modules for API servers, message queues, databases, authentication, logging, and more.

## Features

- 🚀 **BunApiServer** - High-performance HTTP server using Bun's native serve
- 🐰 **RabbitMQ Client** - Robust message queue client with auto-reconnection
- 🗄️ **Sequelize Helpers** - Database utilities and migration support
- 🔐 **JWT Utilities** - Token creation, validation, and payload extraction
- 📝 **Structured Logging** - Winston-based logging with Seq integration
- 📡 **API Client** - Axios wrapper with retry logic and tracing
- ⏱️ **Task Poller** - Periodic task execution with backoff
- 📅 **Job Scheduler** - Cron-like job scheduling
- 🔒 **Semaphore** - Concurrency control utility
- ✅ **Domain Validation** - Fluent validation helpers
- 🎯 **Action Pattern** - Request/Response pattern for API actions

## Quick Start

### API Server

```typescript
import { BunApiServer, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341",
});

const server = new BunApiServer(loggerFactory, 3000);

server.init(
  [], // middlewares
  undefined, // error handler
  { enabled: true, origin: "*" }, // CORS
  50, // max request size MB
  true // log requests
);

server.defineGetRoute("/health", (req, res) => {
  res.json({ status: "ok" });
});

server.defineGetRoute("/users/:id", (req, res) => {
  const userId = req.params.id;
  res.json({ id: userId, name: "John Doe" });
});

server.definePostRoute("/users", (req, res) => {
  const userData = req.body;
  res.status(201).json({ id: Date.now(), ...userData });
});

await server.start();
```

### RabbitMQ Client

```typescript
import { RabbitMqClient, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341",
});

const rabbitClient = new RabbitMqClient(
  "amqp://localhost",
  "my-exchange",
  loggerFactory,
  { name: "my-queue", durable: true }
);

await rabbitClient.init();

// Publish events
await rabbitClient.publishIntegrationEvent({
  name: "user.created",
  data: { userId: 123 },
});

// Subscribe to events
await rabbitClient.registerEventHandler("user.created", async (event) => {
  console.log("User created:", event);
});
```

### JWT Utilities

```typescript
import { Jwt } from "bun-node-common";

const jwt = new Jwt("your-secret-key");

// Create token
const token = jwt.build({
  body: { userId: 123, role: "admin" },
  expiresIn: "24h",
  issuer: "my-app",
});

// Verify token
const isValid = jwt.verify(token);

// Get payload
const payload = jwt.getPayload(token);
```

### Logging

```typescript
import { LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341",
  seqApiKey: "optional-api-key",
  logLevel: "debug",
});

const logger = loggerFactory.current("MyService");

logger.info("Application started", { port: 3000 });
logger.debug("Processing request", { requestId: "abc123" });
logger.warn("Rate limit approaching", { current: 95, max: 100 });
logger.error("Failed to connect", new Error("Connection refused"), {
  host: "db.example.com",
});
```

### API Client

```typescript
import { ApiClient, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341",
});

const client = new ApiClient({
  baseURL: "https://api.example.com",
  timeoutMs: 10000,
  loggerFactory,
  serviceName: "ExternalAPI",
  retries: 3,
});

const response = await client.get("/users");
const created = await client.post("/users", { name: "John" });
```

### Database (Sequelize)

```typescript
import { Sequelize } from "bun-node-common";

const db = new Sequelize(
  "postgres://user:pass@localhost:5432/mydb",
  10, // max connections
  2, // min connections
  30000, // acquire timeout
  10000, // idle timeout
  true // require SSL
);

await db.authenticate();
```

### Action Pattern

```typescript
import { ActionBase, ActionRequestBase, ActionResponse } from "bun-node-common";

class GetUserRequest extends ActionRequestBase {
  userId!: string;

  static validate(obj: GetUserRequest): string[] | undefined {
    const missing: string[] = [];
    if (!obj.userId) missing.push("userId");
    return missing.length > 0 ? missing : undefined;
  }
}

class GetUserAction extends ActionBase<GetUserRequest, { name: string }> {
  protected async executeImpl(): Promise<ActionResponse<{ name: string }>> {
    // Your business logic here
    const user = await fetchUser(this.req.userId);

    if (!user) {
      return this.error(404, "USER_NOT_FOUND", "User not found");
    }

    return this.success({ name: user.name });
  }
}

// Usage in route handler
server.defineGetRoute("/users/:id", async (req, res) => {
  const action = new GetUserAction(
    GetUserRequest,
    { userId: req.params.id },
    new Headers(req.headers)
  );

  const result = await action.execute();
  res.status(result.status).json(result);
});
```

## Modules

| Module          | Description                                           |
| --------------- | ----------------------------------------------------- |
| `api-server`    | Bun-native HTTP server with routing, middleware, CORS |
| `api-client`    | HTTP client with retry, tracing propagation           |
| `rabbit-mq`     | RabbitMQ client with reconnection logic               |
| `sequelize`     | Database wrapper with connection pooling              |
| `jwt`           | JWT creation, validation, payload extraction          |
| `logger`        | Structured logging with Winston and Seq               |
| `action`        | Request/Response action pattern                       |
| `domain`        | Domain ID utilities and validation                    |
| `event-bus`     | In-memory event bus with RxJS                         |
| `job-scheduler` | Cron-like job scheduling                              |
| `task-poller`   | Periodic polling with backoff                         |
| `semaphore`     | Concurrency limiting                                  |
| `settings`      | Configuration loading utilities                       |
| `utils`         | General utilities                                     |
| `uuid`          | UUID generation helpers                               |

## Configuration

### Settings Loader

```typescript
import { SettingsLoader } from "bun-node-common";

interface AppSettings {
  port: number;
  database: {
    connectionString: string;
  };
}

const settings = await SettingsLoader<AppSettings>(
  "./settings.json",
  "./settings.local.json"
);
```

### Environment-based Settings

The library provides typed interfaces for common settings:

- `ApplicationSettings` - General app config
- `ApiServerSettings` - HTTP server config
- `DatabaseSettings` - Database connection config
- `RabbitMqSettings` - Message queue config
- `LogSettings` - Logging config
- `BlockchainSettings` - RPC/WebSocket endpoints

## Requirements

- **Bun** >= 1.0.0
- **Node.js** >= 18 (for npm compatibility)
- **TypeScript** >= 5.0

## License

MIT © Alessio Cavallo
