# Task Poller Module

Periodic task execution utility with configurable intervals and automatic error handling.

## Features

- Configurable polling interval
- Automatic error recovery
- Start/stop control
- Async task support

## Usage

### Basic Setup

```typescript
import { TaskPoller } from "bun-node-common";

const poller = new TaskPoller({
  name: "sync-users",
  intervalMs: 30000, // Poll every 30 seconds
  task: async () => {
    const users = await fetchExternalUsers();
    await syncToDatabase(users);
  }
});

// Start polling
poller.start();

// Stop when needed
poller.stop();
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Identifier for logging |
| `intervalMs` | `number` | Time between polls (ms) |
| `task` | `() => Promise<void>` | Async function to execute |
| `runImmediately` | `boolean` | Run task on start (default: false) |
| `logger` | `ScopedLogger` | Optional logger instance |

### With Logger

```typescript
import { TaskPoller, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({ ... });

const poller = new TaskPoller({
  name: "price-updater",
  intervalMs: 60000,
  logger: loggerFactory.current("PricePoller"),
  task: async () => {
    const prices = await fetchPrices();
    await updateCache(prices);
  }
});
```

## Use Cases

### Cache Refresh

```typescript
const cachePoller = new TaskPoller({
  name: "cache-refresh",
  intervalMs: 5 * 60 * 1000, // 5 minutes
  runImmediately: true,
  task: async () => {
    const data = await fetchLatestData();
    cache.set("data", data);
  }
});
```

### Health Check

```typescript
const healthPoller = new TaskPoller({
  name: "health-check",
  intervalMs: 10000,
  task: async () => {
    const status = await checkDependencies();
    if (!status.healthy) {
      await alertOps(status);
    }
  }
});
```

### Queue Processing

```typescript
const queuePoller = new TaskPoller({
  name: "queue-processor",
  intervalMs: 1000,
  task: async () => {
    const jobs = await getQueuedJobs(10);
    for (const job of jobs) {
      await processJob(job);
    }
  }
});
```

### Data Sync

```typescript
const syncPoller = new TaskPoller({
  name: "external-sync",
  intervalMs: 15 * 60 * 1000, // 15 minutes
  task: async () => {
    const lastSync = await getLastSyncTime();
    const changes = await fetchChanges(lastSync);
    await applyChanges(changes);
    await updateSyncTime();
  }
});
```

## Lifecycle

```typescript
// Create poller (does not start automatically)
const poller = new TaskPoller({ ... });

// Start polling
poller.start();

// Check if running
if (poller.isRunning) {
  console.log("Poller is active");
}

// Stop polling (waits for current task to complete)
poller.stop();
```

## Error Handling

The poller automatically catches and logs errors, continuing to poll:

```typescript
const poller = new TaskPoller({
  name: "resilient-task",
  intervalMs: 5000,
  task: async () => {
    // If this throws, the error is logged
    // and polling continues after the interval
    await riskyOperation();
  }
});
```

For custom error handling:

```typescript
const poller = new TaskPoller({
  name: "custom-error-handling",
  intervalMs: 5000,
  task: async () => {
    try {
      await riskyOperation();
    } catch (error) {
      await handleError(error);
      // Optionally rethrow if you want it logged
    }
  }
});
```

## Best Practices

1. **Set appropriate intervals** - Balance freshness vs. resource usage
2. **Handle errors gracefully** - Don't let one failure break the poller
3. **Use meaningful names** - Helps with debugging and monitoring
4. **Stop pollers on shutdown** - Clean up resources properly
5. **Consider backoff** - For tasks that may temporarily fail
