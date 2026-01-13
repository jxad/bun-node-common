# JWT Module

JSON Web Token utilities for creating, validating, and extracting payloads from JWTs.

## Features

- JWT creation with configurable claims
- Token validation
- Payload extraction with optional validation
- Support for all standard registered claims

## Usage

### Basic Setup

```typescript
import { Jwt } from "bun-node-common";

// Initialize with a secret (can also provide per-operation)
const jwt = new Jwt("your-secret-key");
```

### Creating Tokens

```typescript
const token = jwt.build({
  body: {
    userId: 123,
    role: "admin",
    permissions: ["read", "write"]
  },
  expiresIn: "24h", // or number of seconds
  issuer: "my-app",
  subject: "user-123",
  audience: "my-api"
});
```

### Build Options

| Option | Type | Description |
|--------|------|-------------|
| `body` | `object` | JWT payload (required) |
| `expiresIn` | `string \| number` | Expiration time (required) |
| `secret` | `string` | Override instance secret |
| `notBefore` | `string \| number` | Token not valid before |
| `issuer` | `string` | Token issuer (iss claim) |
| `subject` | `string` | Token subject (sub claim) |
| `audience` | `string \| string[]` | Token audience (aud claim) |
| `jwtid` | `string` | Unique token ID (jti claim) |

### Time Format

Time values can be:
- Numbers: interpreted as seconds
- Strings: parsed by [ms](https://github.com/zeit/ms.js) library
  - `"60"` = 60 seconds
  - `"2 days"` = 2 days
  - `"10h"` = 10 hours
  - `"7d"` = 7 days

### Validating Tokens

```typescript
const isValid = jwt.verify(token);
// Returns true if valid, false if expired/invalid

// With custom secret
const isValid = jwt.verify(token, "different-secret");
```

### Extracting Payload

```typescript
// Without validation (just decode)
const payload = jwt.getPayload(token);

// With validation (throws if invalid)
const payload = jwt.getPayload(token, true);

// With custom secret
const payload = jwt.getPayload(token, true, "custom-secret");
```

## Examples

### Access Token with Refresh

```typescript
const jwt = new Jwt(process.env.JWT_SECRET);

// Short-lived access token
const accessToken = jwt.build({
  body: { userId: 123, type: "access" },
  expiresIn: "15m",
  issuer: "auth-service"
});

// Long-lived refresh token
const refreshToken = jwt.build({
  body: { userId: 123, type: "refresh" },
  expiresIn: "7d",
  issuer: "auth-service"
});
```

### API Key Token

```typescript
const apiToken = jwt.build({
  body: {
    apiKeyId: "key-abc123",
    scopes: ["read:users", "write:posts"]
  },
  expiresIn: "365d",
  subject: "api-key",
  audience: "my-api"
});
```

### Middleware Integration

```typescript
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }
  
  if (!jwt.verify(token)) {
    return res.status(401).json({ error: "Invalid token" });
  }
  
  const payload = JSON.parse(jwt.getPayload(token));
  req.user = payload;
  
  return next();
};
```

## Security Notes

- Always use strong, random secrets (min 256 bits recommended)
- Store secrets in environment variables, never in code
- Use short expiration times for access tokens
- Consider using asymmetric keys (RS256) for public verification
