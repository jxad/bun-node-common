# Utils Module

General utility functions for common operations.

## Features

- Async helpers
- Object manipulation
- String utilities
- Type guards

## Usage

### Import

```typescript
import { /* utilities */ } from "bun-node-common";
```

## Available Utilities

### Sleep / Delay

```typescript
import { sleep } from "bun-node-common";

// Wait for 1 second
await sleep(1000);

// Use in retry logic
for (let i = 0; i < 3; i++) {
  try {
    return await fetchData();
  } catch {
    await sleep(1000 * Math.pow(2, i)); // Exponential backoff
  }
}
```

### Retry with Backoff

```typescript
import { retry } from "bun-node-common";

const result = await retry(
  async () => {
    return await unreliableOperation();
  },
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  }
);
```

### Chunk Array

```typescript
import { chunk } from "bun-node-common";

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const batches = chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

// Process in batches
for (const batch of batches) {
  await processBatch(batch);
}
```

### Deep Clone

```typescript
import { deepClone } from "bun-node-common";

const original = { a: 1, b: { c: 2 } };
const copy = deepClone(original);

copy.b.c = 99;
console.log(original.b.c); // Still 2
```

### Is Empty

```typescript
import { isEmpty } from "bun-node-common";

isEmpty(null);      // true
isEmpty(undefined); // true
isEmpty("");        // true
isEmpty([]);        // true
isEmpty({});        // true
isEmpty("hello");   // false
isEmpty([1, 2]);    // false
```

### Safe JSON Parse

```typescript
import { safeJsonParse } from "bun-node-common";

const valid = safeJsonParse('{"a": 1}');    // { a: 1 }
const invalid = safeJsonParse('not json');   // undefined
const withDefault = safeJsonParse('bad', {}); // {}
```

### Omit / Pick

```typescript
import { omit, pick } from "bun-node-common";

const user = { id: 1, name: "John", password: "secret", email: "j@example.com" };

const safe = omit(user, ["password"]);
// { id: 1, name: "John", email: "j@example.com" }

const minimal = pick(user, ["id", "name"]);
// { id: 1, name: "John" }
```

### Debounce / Throttle

```typescript
import { debounce, throttle } from "bun-node-common";

// Debounce: Execute after 300ms of no calls
const debouncedSearch = debounce(async (query: string) => {
  return await searchApi(query);
}, 300);

// Throttle: Execute at most once per 1000ms
const throttledLog = throttle((message: string) => {
  console.log(message);
}, 1000);
```

### Group By

```typescript
import { groupBy } from "bun-node-common";

const users = [
  { name: "Alice", role: "admin" },
  { name: "Bob", role: "user" },
  { name: "Charlie", role: "admin" }
];

const byRole = groupBy(users, "role");
// {
//   admin: [{ name: "Alice", role: "admin" }, { name: "Charlie", role: "admin" }],
//   user: [{ name: "Bob", role: "user" }]
// }
```

### Unique

```typescript
import { unique, uniqueBy } from "bun-node-common";

// Simple array
unique([1, 2, 2, 3, 3, 3]); // [1, 2, 3]

// By property
const items = [
  { id: 1, name: "A" },
  { id: 2, name: "B" },
  { id: 1, name: "A duplicate" }
];
uniqueBy(items, "id"); // [{ id: 1, name: "A" }, { id: 2, name: "B" }]
```

## Type Guards

```typescript
import { isString, isNumber, isArray, isObject } from "bun-node-common";

function processValue(value: unknown) {
  if (isString(value)) {
    return value.toUpperCase();
  }
  if (isNumber(value)) {
    return value * 2;
  }
  if (isArray(value)) {
    return value.length;
  }
  return null;
}
```

## Best Practices

1. **Import only what you need** - Tree-shaking friendly
2. **Prefer built-in methods** when available
3. **Use type guards** for runtime type checking
4. **Combine utilities** for complex operations
