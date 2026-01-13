# RabbitMQ Module

Robust RabbitMQ client with automatic reconnection, heartbeat monitoring, and event-based messaging.

## Features

- Automatic reconnection with exponential backoff
- Connection heartbeat to prevent proxy timeouts
- Event publishing and subscription
- Quorum queues for high availability
- Structured logging integration

## Usage

### Basic Setup

```typescript
import { RabbitMqClient, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({
  applicationName: "my-app",
  instanceId: "instance-1",
  seqServerUrl: "http://localhost:5341"
});

const client = new RabbitMqClient(
  "amqp://user:password@localhost:5672",
  "my-exchange",
  loggerFactory,
  {
    name: "my-queue",
    durable: true,
    exclusive: false,
    autoDelete: false
  }
);

await client.init();
```

### Publishing Events

```typescript
interface UserCreatedEvent {
  name: string;
  userId: number;
  email: string;
  createdAt: Date;
}

await client.publishIntegrationEvent({
  name: "user.created",
  userId: 123,
  email: "user@example.com",
  createdAt: new Date()
});
```

### Subscribing to Events

```typescript
await client.registerEventHandler<UserCreatedEvent>(
  "user.created",
  async (event) => {
    console.log("New user:", event.userId, event.email);
    // Process the event...
  }
);

// Multiple handlers for different events
await client.registerEventHandler("order.placed", handleOrder);
await client.registerEventHandler("payment.completed", handlePayment);
```

### Closing Connection

```typescript
await client.close();
```

## Configuration

### Queue Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `""` | Queue name (empty = auto-generated) |
| `durable` | `boolean` | `true` | Survive broker restart |
| `exclusive` | `boolean` | `false` | Single consumer only |
| `autoDelete` | `boolean` | `false` | Delete when no consumers |
| `arguments` | `object` | `{}` | Additional queue arguments |

### Connection Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Max reconnect attempts | 10 | Maximum retry attempts |
| Initial reconnect delay | 5s | Starting delay between retries |
| Max reconnect delay | 30s | Maximum delay (exponential backoff) |
| Heartbeat interval | 25s | Keep-alive ping interval |

## Event Format

Events must extend `RabbitMqEventBase`:

```typescript
interface RabbitMqEventBase {
  name: string;  // Routing key for the event
  [key: string]: any;
}
```

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Producer   │────▶│   Exchange   │────▶│    Queue     │
│   Service    │     │   (direct)   │     │  (quorum)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │   Consumer   │
                                          │   Service    │
                                          └──────────────┘
```

## Error Handling

The client automatically handles:

- **Connection errors**: Triggers reconnection
- **Channel errors**: Recreates channel
- **Message processing errors**: Nacks message (no requeue to prevent infinite loops)

```typescript
// Messages that fail processing are rejected without requeue
// Consider setting up a dead-letter exchange for failed messages
```

## Best Practices

1. **Use meaningful routing keys**: `entity.action` pattern (e.g., `user.created`, `order.shipped`)
2. **Keep handlers idempotent**: Messages may be redelivered
3. **Handle errors gracefully**: Wrap handler logic in try/catch
4. **Monitor connection status**: Log reconnection events
5. **Use durable queues**: For important messages that must survive restarts

## Example: Microservice Communication

```typescript
// Service A: Publisher
const publisher = new RabbitMqClient(amqpUrl, "orders-exchange", logger);
await publisher.init();

await publisher.publishIntegrationEvent({
  name: "order.created",
  orderId: "ord-123",
  items: [{ sku: "ITEM-1", qty: 2 }],
  total: 99.99
});

// Service B: Consumer
const consumer = new RabbitMqClient(
  amqpUrl,
  "orders-exchange",
  logger,
  { name: "inventory-service-queue", durable: true }
);
await consumer.init();

await consumer.registerEventHandler("order.created", async (event) => {
  for (const item of event.items) {
    await reserveInventory(item.sku, item.qty);
  }
});
```
