# Action Module

Request/Response pattern implementation for building structured API actions with validation, authentication, and error handling.

## Features

- Type-safe request/response handling
- Automatic request validation
- JWT authentication support
- Standardized error responses
- Unique request IDs for tracing

## Core Concepts

### Actions
An `Action` represents a single API operation (query or command) with:
- Typed request input
- Typed response output
- Built-in validation
- Optional JWT authentication

### Request Classes
Extend `ActionRequestBase` to define expected input with validation.

### Response Format
All actions return `ActionResponse<T>` with consistent structure.

## Usage

### Define a Request

```typescript
import { ActionRequestBase } from "bun-node-common";

class CreateUserRequest extends ActionRequestBase {
  email!: string;
  name!: string;
  role?: string;

  static validate(obj: CreateUserRequest): string[] | undefined {
    const missing: string[] = [];
    
    if (!obj.email) missing.push("email");
    if (!obj.name) missing.push("name");
    
    return missing.length > 0 ? missing : undefined;
  }
}
```

### Create an Action

```typescript
import { ActionBase, ActionResponse } from "bun-node-common";

interface CreateUserResponse {
  id: string;
  email: string;
  name: string;
}

class CreateUserAction extends ActionBase<CreateUserRequest, CreateUserResponse> {
  constructor(request: CreateUserRequest, headers: Headers) {
    super(CreateUserRequest, request, headers);
    
    // Optional: Enable JWT validation
    this.setOptions({
      enableJwtValidation: true,
      jwtSecret: process.env.JWT_SECRET
    });
  }

  protected async executeImpl(): Promise<ActionResponse<CreateUserResponse>> {
    // Check for existing user
    const existing = await db.users.findByEmail(this.req.email);
    if (existing) {
      return this.error(409, "USER_EXISTS", "User already exists");
    }

    // Create user
    const user = await db.users.create({
      id: generateId(),
      email: this.req.email,
      name: this.req.name,
      role: this.req.role ?? "user"
    });

    return this.success({
      id: user.id,
      email: user.email,
      name: user.name
    });
  }
}
```

### Use in Route Handler

```typescript
server.definePostRoute("/users", async (req, res) => {
  const action = new CreateUserAction(
    req.body,
    new Headers(req.headers as Record<string, string>)
  );
  
  const result = await action.execute();
  res.status(result.status).json(result);
});
```

## Response Structure

### Success Response

```typescript
{
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  status: 200,
  data: {
    id: "user-123",
    email: "user@example.com",
    name: "John Doe"
  }
}
```

### Error Response

```typescript
{
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  status: 400,
  message: "Missing required fields [email]",
  errors: [
    {
      code: "MISSING_REQUIRED_FIELDS",
      message: "Missing required fields [email]"
    }
  ]
}
```

## Action Options

```typescript
interface ActionOptions {
  // Return 400 if required fields are missing (default: true)
  badRequestOnMissingParameters: boolean;
  
  // Enable JWT validation (default: false)
  enableJwtValidation: boolean;
  
  // Secret for JWT validation
  jwtSecret?: string;
}
```

## JWT Integration

### Access JWT in Actions

```typescript
class ProtectedAction extends ActionBase<MyRequest, MyResponse> {
  constructor(request: MyRequest, headers: Headers) {
    super(MyRequest, request, headers);
    this.setOptions({
      enableJwtValidation: true,
      jwtSecret: process.env.JWT_SECRET
    });
  }

  protected async executeImpl(): Promise<ActionResponse<MyResponse>> {
    // Access raw JWT
    const token = this.jwt;
    
    // Get decoded payload
    const payload = this.getJwtPayload<{ userId: string; role: string }>();
    
    if (payload?.role !== "admin") {
      return this.error(403, "FORBIDDEN", "Admin access required");
    }
    
    // Continue with authorized logic...
  }
}
```

## Error Handling Helpers

```typescript
// Single error
return this.error(
  404,                          // HTTP status
  "USER_NOT_FOUND",            // Error code
  "User not found",            // User-friendly message
  new Error("DB lookup failed") // Optional: Original error
);

// Multiple errors
return this.errorWithErrors(
  400,
  "Validation failed",
  [
    { code: "INVALID_EMAIL", message: "Email format is invalid" },
    { code: "NAME_TOO_SHORT", message: "Name must be at least 2 characters" }
  ]
);
```

## Response Codes

The module provides standard HTTP status code constants:

```typescript
import { ResponseCodes } from "bun-node-common";

ResponseCodes.OK                    // 200
ResponseCodes.CREATED               // 201
ResponseCodes.BAD_REQUEST           // 400
ResponseCodes.UNAUTHORIZED          // 401
ResponseCodes.FORBIDDEN             // 403
ResponseCodes.NOT_FOUND             // 404
ResponseCodes.CONFLICT              // 409
ResponseCodes.INTERNAL_SERVER_ERROR // 500
```

## Complete Example

```typescript
// request.ts
class GetUserRequest extends ActionRequestBase {
  userId!: string;

  static validate(obj: GetUserRequest): string[] | undefined {
    if (!obj.userId) return ["userId"];
    return undefined;
  }
}

// action.ts
class GetUserAction extends ActionBase<GetUserRequest, User> {
  private userService: UserService;

  constructor(
    request: GetUserRequest,
    headers: Headers,
    userService: UserService
  ) {
    super(GetUserRequest, request, headers);
    this.userService = userService;
  }

  protected async executeImpl(): Promise<ActionResponse<User>> {
    const user = await this.userService.findById(this.req.userId);
    
    if (!user) {
      return this.error(404, "NOT_FOUND", "User not found");
    }
    
    return this.success(user);
  }
}

// route.ts
server.defineGetRoute("/users/:id", async (req, res) => {
  const action = new GetUserAction(
    { userId: req.params.id },
    new Headers(req.headers),
    userService
  );
  
  const result = await action.execute();
  res.status(result.status).json(result);
});
```

## Best Practices

1. **Keep actions focused** - One action per operation
2. **Validate all input** - Use the validate static method
3. **Use meaningful error codes** - Help with debugging
4. **Return appropriate status codes** - Follow HTTP conventions
5. **Inject dependencies** - Pass services through constructor
6. **Log important operations** - Use request IDs for tracing
