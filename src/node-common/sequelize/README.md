# Sequelize Module

Database utilities built on Sequelize ORM with connection pooling, SSL support, and migration helpers.

## Features

- Sequelize wrapper with sensible defaults
- Connection pool management
- SSL configuration
- Migration base class
- Context base for repository pattern

## Usage

### Basic Setup

```typescript
import { Sequelize } from "bun-node-common";

const db = new Sequelize(
  "postgres://user:password@localhost:5432/mydb",
  10,    // max pool connections
  2,     // min pool connections
  30000, // acquire timeout (ms)
  10000, // idle timeout (ms)
  true   // require SSL
);

// Test connection
await db.authenticate();
console.log("Database connected");
```

### Connection Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `connectionString` | `string` | PostgreSQL connection URL |
| `poolMaxConnections` | `number` | Maximum connections in pool (> 0) |
| `poolMinConnections` | `number` | Minimum connections in pool (>= 0) |
| `poolMaxTimeForConnection` | `number` | Max time to acquire connection (ms) |
| `poolMaxIdleConnectionTime` | `number` | Max idle time before release (ms) |
| `sslRequire` | `boolean` | Require SSL connection (default: true) |

### Defining Models

```typescript
import { Sequelize, DataTypes } from "bun-node-common";

const User = db.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "users",
  timestamps: true
});
```

### Using Operators

```typescript
import { Op } from "bun-node-common";

const users = await User.findAll({
  where: {
    createdAt: {
      [Op.gte]: new Date("2024-01-01")
    },
    email: {
      [Op.like]: "%@example.com"
    }
  }
});
```

### Context Base Pattern

Use `ContextBase` for repository-style data access:

```typescript
import { ContextBase } from "bun-node-common";

class UserContext extends ContextBase {
  async findByEmail(email: string) {
    return this.db.models.User.findOne({
      where: { email }
    });
  }

  async createUser(data: { email: string; name: string }) {
    return this.db.models.User.create(data);
  }
}

const userContext = new UserContext(db);
const user = await userContext.findByEmail("user@example.com");
```

### Migrations

Use `MigrationBase` for database migrations:

```typescript
import { MigrationBase } from "bun-node-common";
import type { QueryInterface, DataTypes } from "sequelize";

export class CreateUsersTable extends MigrationBase {
  async up(queryInterface: QueryInterface, dataTypes: typeof DataTypes) {
    await queryInterface.createTable("users", {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true
      },
      email: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false
      },
      created_at: {
        type: dataTypes.DATE,
        defaultValue: dataTypes.NOW
      },
      updated_at: {
        type: dataTypes.DATE,
        defaultValue: dataTypes.NOW
      }
    });

    await queryInterface.addIndex("users", ["email"]);
  }

  async down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("users");
  }
}
```

## Configuration Examples

### Development (No SSL)

```typescript
const db = new Sequelize(
  "postgres://dev:dev@localhost:5432/myapp_dev",
  5, 1, 10000, 5000,
  false // SSL not required for local dev
);
```

### Production (With SSL)

```typescript
const db = new Sequelize(
  process.env.DATABASE_URL!,
  20,    // higher pool for production
  5,     // maintain minimum connections
  30000, // longer acquire timeout
  60000, // longer idle timeout
  true   // SSL required
);
```

### Connection String Format

```
postgres://[user]:[password]@[host]:[port]/[database]
```

Examples:
- `postgres://admin:secret@db.example.com:5432/production`
- `postgres://user:pass@localhost:5432/development`

## Exported Types

- `Sequelize` - Main database class
- `DataTypes` - Column type definitions
- `Op` - Query operators
- `Includeable` - Type for eager loading
- `ContextBase` - Base class for repositories
- `MigrationBase` - Base class for migrations

## Best Practices

1. **Use environment variables** for connection strings
2. **Set appropriate pool sizes** based on your workload
3. **Enable SSL** in production environments
4. **Use transactions** for multi-statement operations
5. **Index frequently queried columns**
6. **Use migrations** for schema changes
