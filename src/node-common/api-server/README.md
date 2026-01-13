# BunApiServer

## Description
`BunApiServer` is an adapted version of `ApiServer` that uses Bun.js native HTTP server instead of Express.js. It maintains the same API for compatibility but uses `Bun.serve()` internally.

## Key Features
- Native Bun.js HTTP server for superior performance
- API compatibility with existing Express ApiServer
- Built-in tracing/logging middleware
- Native CORS handling
- Parametric routing (e.g., `/users/:id`)
- Centralized error handling
- Automatic body parsing for JSON, form-data, and text

## Basic Usage

```typescript
import { BunApiServer } from "./api-server";
import { SeqLoggerFactory } from "./seq-logger";

const loggerFactory = new SeqLoggerFactory({
  applicationName: "my-bun-app",
  instanceId: "local",
  seqServerUrl: "http://localhost:5341",
});

const server = new BunApiServer(loggerFactory, 3000);

server.init(
  (api) => {
    // Register routes
    api.defineGetRoute("/ping", (req, res) => {
      req.log.info("Ping received");
      res.json({ message: "pong", timestamp: Date.now() });
    });

    api.defineGetRoute("/users/:id", (req, res) => {
      const userId = req.params.id;
      req.log.info(`Getting user ${userId}`);
      res.json({ id: userId, name: "John Doe" });
    });

    api.definePostRoute("/users", async (req, res) => {
      const userData = req.body;
      req.log.info("Creating user", { userData });

      // Simulate user creation
      const newUser = { id: Date.now(), ...userData };
      res.status(201).json(newUser);
    });
  },
  [], // custom middlewares
  (err, req, res) => {
    // Custom error handler
    req.log.error("Custom error handler", err);
    return res.status(500).json({ error: "Something went wrong" });
  },
  { // CORS settings
    enabled: true,
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  10, // Request size limit in MB
  true // Log requests
);

// Start the server
await server.start();
console.log("Server started on http://localhost:3000");
```

## Custom Middlewares

Middlewares in BunApiServer work similarly to Express but are asynchronous:

```typescript
import type { BunMiddleware } from "./api-server";

const authMiddleware: BunMiddleware = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  // Verify token
  try {
    const user = await verifyToken(token);
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

server.init(
  (api) => {
    api.defineGetRoute("/protected", (req, res) => {
      res.json({ message: `Hello ${req.user.name}` });
    });
  },
  [authMiddleware] // Add the middleware
);
```

## Key Differences from Express

### 1. Native Bun.js Server
- Uses `Bun.serve()` instead of `express()`
- Better performance for I/O intensive operations
- Native WebSocket support (future)

### 2. Automatic Body Parsing
```typescript
// Express required express.json()
app.use(express.json());

// BunApiServer does it automatically
// Supports JSON, form-data, and text
```

### 3. Headers
```typescript
// Express
const userAgent = req.get('user-agent');
const contentType = req.headers['content-type'];

// BunApiServer (same API but different implementation)
const userAgent = req.get('user-agent');
const contentType = req.headers['content-type'];
```

### 4. Async Handling
```typescript
// Middlewares must be asynchronous
const middleware: BunMiddleware = async (req, res, next) => {
  // Async operations
  await someAsyncOperation();
  return next();
};
```

## Parametric Routing

```typescript
server.init((api) => {
  // Simple parameters
  api.defineGetRoute("/users/:id", (req, res) => {
    const id = req.params.id;
    res.json({ id });
  });

  // Multiple parameters
  api.defineGetRoute("/users/:userId/posts/:postId", (req, res) => {
    const { userId, postId } = req.params;
    res.json({ userId, postId });
  });
});
```

## Error Handling

```typescript
const errorHandler = (err: Error, req: BunApiServerRequest, res: BunApiServerResponse) => {
  // Automatic logging already done by the tracing system

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Generic error
  return res.status(500).json({ error: 'Internal server error' });
};

server.init(controllers, middlewares, errorHandler);
```

## Query Parameters

```typescript
api.defineGetRoute("/search", (req, res) => {
  const { q, limit = 10, offset = 0 } = req.query;
  req.log.info("Search query", { q, limit, offset });

  // Execute search
  res.json({ query: q, results: [] });
});
```

## Performance

BunApiServer offers superior performance compared to the Express version:
- Faster native HTTP server
- Optimized asynchronous I/O handling
- Reduced memory footprint
- Faster startup time

## Migration from Express

1. Replace `ApiServer` with `BunApiServer`
2. Make custom middlewares asynchronous
3. Verify request/response types are compatible
4. Test parametric routing
5. Update error handling if necessary

Most existing code should work without significant changes.
