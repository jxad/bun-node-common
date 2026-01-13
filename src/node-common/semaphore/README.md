# Semaphore Module

Concurrency control utility for limiting parallel execution of async operations.

## Features

- Configurable concurrency limit
- FIFO queue for waiting operations
- Promise-based async/await API
- Automatic release on completion

## Usage

### Basic Setup

```typescript
import { Semaphore } from "bun-node-common";

// Allow max 3 concurrent operations
const semaphore = new Semaphore(3);
```

### Acquiring and Releasing

```typescript
async function processItem(item: Item) {
  await semaphore.acquire();
  
  try {
    // Critical section - max 3 concurrent executions
    await heavyOperation(item);
  } finally {
    semaphore.release();
  }
}

// Process many items with controlled concurrency
await Promise.all(items.map(processItem));
```

### With Helper Method

```typescript
// Using runExclusive for automatic acquire/release
const result = await semaphore.runExclusive(async () => {
  return await heavyOperation();
});
```

## Use Cases

### Rate Limiting API Calls

```typescript
const apiSemaphore = new Semaphore(5); // Max 5 concurrent API calls

async function fetchUser(id: string) {
  return apiSemaphore.runExclusive(async () => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  });
}

// Fetch 100 users with max 5 concurrent requests
const users = await Promise.all(
  userIds.map(id => fetchUser(id))
);
```

### Database Connection Limiting

```typescript
const dbSemaphore = new Semaphore(10); // Match DB pool size

async function executeQuery(sql: string) {
  return dbSemaphore.runExclusive(async () => {
    return await db.query(sql);
  });
}
```

### File Processing

```typescript
const fileSemaphore = new Semaphore(4); // Process 4 files at a time

async function processFile(path: string) {
  await fileSemaphore.acquire();
  
  try {
    const content = await Bun.file(path).text();
    const processed = transform(content);
    await Bun.write(path, processed);
  } finally {
    fileSemaphore.release();
  }
}

// Process all files with controlled concurrency
await Promise.all(files.map(processFile));
```

### Worker Pool Pattern

```typescript
class WorkerPool {
  private semaphore: Semaphore;
  
  constructor(workerCount: number) {
    this.semaphore = new Semaphore(workerCount);
  }
  
  async execute<T>(task: () => Promise<T>): Promise<T> {
    return this.semaphore.runExclusive(task);
  }
}

const pool = new WorkerPool(8);

// Execute tasks with limited parallelism
const results = await Promise.all(
  tasks.map(task => pool.execute(task))
);
```

## API

### Constructor

```typescript
new Semaphore(maxConcurrent: number)
```

Creates a new semaphore with the specified concurrency limit.

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `acquire()` | `Promise<void>` | Wait to acquire a slot |
| `release()` | `void` | Release a slot |
| `runExclusive<T>(fn)` | `Promise<T>` | Acquire, run, release automatically |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `available` | `number` | Currently available slots |
| `waiting` | `number` | Number of waiting operations |

## Best Practices

1. **Always release** - Use try/finally or `runExclusive`
2. **Match limits to resources** - Set concurrency based on actual constraints
3. **Avoid deadlocks** - Don't nest semaphore acquisitions
4. **Consider timeouts** - Add timeout logic for long operations
