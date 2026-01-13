# Settings Module

Configuration loading utilities with support for environment-specific overrides and typed settings interfaces.

## Features

- JSON settings file loading
- Local override support (settings.local.json)
- Typed settings interfaces
- Environment-specific configuration

## Usage

### Settings Loader

```typescript
import { SettingsLoader } from "bun-node-common";

interface AppSettings {
  port: number;
  environment: string;
  database: {
    connectionString: string;
    poolSize: number;
  };
  logging: {
    level: string;
    seqUrl: string;
  };
}

const settings = await SettingsLoader<AppSettings>(
  "./settings.json",
  "./settings.local.json"
);

console.log(settings?.port); // 3000
```

### Settings File Structure

**settings.json** (base configuration, committed to repo):
```json
{
  "port": 3000,
  "environment": "development",
  "database": {
    "connectionString": "postgres://localhost:5432/myapp",
    "poolSize": 5
  },
  "logging": {
    "level": "info",
    "seqUrl": "http://localhost:5341"
  }
}
```

**settings.local.json** (local overrides, gitignored):
```json
{
  "database": {
    "connectionString": "postgres://custom:pass@localhost:5432/myapp_dev"
  },
  "logging": {
    "level": "debug"
  }
}
```

The loader merges local settings over base settings.

## Provided Interfaces

### ApplicationSettings

```typescript
interface ApplicationSettings {
  applicationName: string;
  instanceId: string;
  environment: string;
}
```

### ApiServerSettings

```typescript
interface ApiServerSettings {
  port: number;
  requestSizeLimitMb: number;
  cors: {
    enabled: boolean;
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
  };
}
```

### DatabaseSettings

```typescript
interface DatabaseSettings {
  connectionString: string;
  poolMaxConnections: number;
  poolMinConnections: number;
  poolMaxTimeForConnection: number;
  poolMaxIdleConnectionTime: number;
  sslRequire: boolean;
}
```

### LogSettings

```typescript
interface LogSettings {
  level: "trace" | "debug" | "info" | "warn" | "error";
  seqServerUrl: string;
  seqApiKey?: string;
}
```

### RabbitMqSettings

```typescript
interface RabbitMqSettings {
  host: string;
  exchange: string;
  queue?: {
    name: string;
    durable: boolean;
    exclusive: boolean;
    autoDelete: boolean;
  };
}
```

### BlockchainSettings

```typescript
interface BlockchainSettings {
  networks: Record<string, NetworkSettings>;
}

interface NetworkSettings {
  primary: RpcEndpointSettings;
  secondary?: RpcEndpointSettings[];
}

interface RpcEndpointSettings {
  rpcUrl: string;
  wsUrl?: string;
  apiKey?: string;
}
```

## Complete Example

```typescript
import { 
  SettingsLoader,
  ApplicationSettings,
  ApiServerSettings,
  DatabaseSettings,
  LogSettings
} from "bun-node-common";

interface MyAppSettings extends 
  ApplicationSettings,
  ApiServerSettings,
  DatabaseSettings,
  LogSettings {
  // Custom settings
  featureFlags: {
    enableNewFeature: boolean;
  };
}

async function loadSettings(): Promise<MyAppSettings> {
  const settings = await SettingsLoader<MyAppSettings>(
    import.meta.resolve("./settings.json"),
    import.meta.resolve("./settings.local.json")
  );

  if (!settings) {
    throw new Error("Failed to load settings");
  }

  return settings;
}

// Usage
const settings = await loadSettings();

const server = new BunApiServer(loggerFactory, settings.port);
const db = new Sequelize(
  settings.connectionString,
  settings.poolMaxConnections,
  settings.poolMinConnections,
  settings.poolMaxTimeForConnection,
  settings.poolMaxIdleConnectionTime,
  settings.sslRequire
);
```

## Best Practices

1. **Never commit secrets** - Use settings.local.json for sensitive data
2. **Add settings.local.json to .gitignore**
3. **Use typed interfaces** - Leverage TypeScript for validation
4. **Provide sensible defaults** in base settings
5. **Document all settings** in your project README
