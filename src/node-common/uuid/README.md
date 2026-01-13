# UUID Module

UUID generation utilities for creating unique identifiers.

## Features

- UUID v1 (timestamp-based)
- UUID v4 (random)
- Base58 encoding for shorter IDs
- Validation utilities

## Usage

### Basic Generation

```typescript
import { Uuid } from "bun-node-common";

// Generate UUID v4 (random)
const id = Uuid.v4();
// "550e8400-e29b-41d4-a716-446655440000"

// Generate UUID v1 (timestamp-based)
const timestampId = Uuid.v1();
// "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
```

### Short IDs (Base58)

```typescript
import { Uuid } from "bun-node-common";

// Generate short base58-encoded ID
const shortId = Uuid.short();
// "7kQFJTxkWh8Bfj"

// Convert UUID to short format
const uuid = "550e8400-e29b-41d4-a716-446655440000";
const short = Uuid.toBase58(uuid);
// "7kQFJTxkWh8Bfj"

// Convert back
const original = Uuid.fromBase58(short);
// "550e8400-e29b-41d4-a716-446655440000"
```

### Validation

```typescript
import { Uuid } from "bun-node-common";

Uuid.isValid("550e8400-e29b-41d4-a716-446655440000"); // true
Uuid.isValid("not-a-uuid"); // false
Uuid.isValid(""); // false
```

## Use Cases

### Database Primary Keys

```typescript
interface User {
  id: string;
  email: string;
}

const newUser: User = {
  id: Uuid.v4(),
  email: "user@example.com"
};

await db.users.create(newUser);
```

### API Request IDs

```typescript
app.use((req, res, next) => {
  req.requestId = Uuid.v1(); // Timestamp-based for ordering
  res.setHeader("X-Request-ID", req.requestId);
  next();
});
```

### Short URLs / References

```typescript
// For user-facing IDs (shorter, URL-safe)
const order = {
  id: Uuid.v4(),
  shortRef: Uuid.short(), // "7kQFJTxkWh8Bfj"
  // ...
};

// User sees: /orders/7kQFJTxkWh8Bfj
// Database stores full UUID for relationships
```

### File Names

```typescript
async function uploadFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop();
  const filename = `${Uuid.v4()}.${extension}`;
  
  await storage.upload(filename, file);
  return filename;
}
```

### Idempotency Keys

```typescript
async function createPayment(amount: number, idempotencyKey?: string) {
  const key = idempotencyKey ?? Uuid.v4();
  
  // Check if already processed
  const existing = await db.payments.findByIdempotencyKey(key);
  if (existing) {
    return existing;
  }
  
  // Process payment...
}
```

## UUID Versions

### v1 (Timestamp)
- Based on current timestamp + MAC address
- Sortable by creation time
- Slightly predictable
- Good for: logs, audit trails, time-ordered records

### v4 (Random)
- Fully random
- No information leakage
- Not sortable
- Good for: primary keys, tokens, general identifiers

## API Reference

```typescript
class Uuid {
  // Generate UUIDs
  static v1(): string;
  static v4(): string;
  static short(): string;
  
  // Conversion
  static toBase58(uuid: string): string;
  static fromBase58(base58: string): string;
  
  // Validation
  static isValid(value: string): boolean;
}
```

## Best Practices

1. **Use v4 for primary keys** - Random, no information leakage
2. **Use v1 for logs/events** - Sortable by time
3. **Use short IDs for user-facing** - Easier to read/share
4. **Validate external UUIDs** - Don't trust user input
5. **Store as proper UUID type** in databases when possible
