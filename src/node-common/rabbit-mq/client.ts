import * as amqp from 'amqplib';
import { type ScopedLogger, LoggerFactory } from '../logger';
import type { IRabbitMqClient } from "./interface";
import type { QueueConfig, RabbitMqEventBase } from "./types";

/**
 * Enhanced RabbitMQ Client with robust connection management and reconnection logic.
 */
export class RabbitMqClient implements IRabbitMqClient {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private eventHandlers: Map<string, ((eventContent: any) => Promise<void>)[]> = new Map();
  private queueName: string | null = null;
  private consumerTag: string | null = null;
  private consumerSetupPromise: Promise<void> | null = null;
  private isInitialized = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds
  private readonly maxReconnectDelay = 30000; // 30 seconds
  private connectionClosedByServer = false;
  private readonly logger: ScopedLogger | undefined;
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly heartbeatIntervalMs = 25000; // 25 seconds (less than proxy timeout)
  private readonly heartbeatQueueName: string;

  constructor(
    private readonly host: string,
    private readonly exchange: string,
    loggerFactory?: LoggerFactory,
    private readonly queueConfig?: QueueConfig
  ) {
    this.logger = loggerFactory?.forClass(this);

    // Generate unique heartbeat queue name for this client instance
    const queueName = this.queueConfig?.name || '';
    const queueSuffix = queueName ? `-${queueName}` : '';
    this.heartbeatQueueName = `heartbeat-${this.exchange}${queueSuffix}-${Date.now()}`;
  }

  private logDebug(message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.debug(
        message,
        meta
      );
    } else {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  }

  private logInfo(message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.info(
        message,
        meta
      );
    } else {
      console.log(`[INFO] ${message}`, meta || '');
    }
  }

  private logWarn(message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.warn(
        message,
        meta
      );
    } else {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  private logError(message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.error(
        message,
        new Error(message),
        meta
      );
    } else {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.connection && this.channel) {
          // Send a heartbeat by publishing to a dedicated queue
          await this.sendHeartbeat();
        }
      } catch (error) {
        this.logWarn('Heartbeat failed, connection might be down', {
          error: error instanceof Error ? error.message : String(error) || 'Unknown error',
          exchange: this.exchange
        });
        // Don't trigger reconnection here, let the connection error handlers do it
      }
    }, this.heartbeatIntervalMs);

    this.logDebug('Heartbeat started', {
      intervalMs: this.heartbeatIntervalMs,
      exchange: this.exchange
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      this.logDebug('Heartbeat stopped', {
        exchange: this.exchange
      });
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.channel) {
      return;
    }

    try {
      // Create a temporary queue for heartbeat if it doesn't exist
      await this.channel.assertQueue(this.heartbeatQueueName, {
        durable: false,
        autoDelete: true,
        exclusive: true
      });

      // Publish a heartbeat message
      const heartbeatMessage = {
        timestamp: Date.now(),
        clientId: `${this.exchange}-${Date.now()}`,
        type: 'heartbeat'
      };

      this.channel.publish(
        this.exchange,
        'heartbeat',
        Buffer.from(JSON.stringify(heartbeatMessage))
      );

      this.logDebug('Heartbeat sent', {
        timestamp: heartbeatMessage.timestamp,
        clientId: heartbeatMessage.clientId,
        exchange: this.exchange
      });
    } catch (error) {
      this.logWarn('Failed to send heartbeat', {
        error: error instanceof Error ? error.message : String(error) || 'Unknown error',
        exchange: this.exchange
      });
      throw error;
    }
  }

  async init() {
    if (this.isInitialized) {
      return;
    }

    await this.connect();
    this.isInitialized = true;
  }

  private async connect(): Promise<void> {
    try {
      // Reset connection state
      this.connectionClosedByServer = false;

      // Close existing connection if any and not already closed by server
      if (this.connection && !this.connectionClosedByServer) {
        try {
          // Try to close the connection, but don't fail if it's already closed
          await this.connection.close();
        } catch (error) {
          // Ignore errors when closing connection - it might already be closed
          const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
          this.logWarn('Error closing existing connection (this is normal if connection was already closed)', {
            error: errorMessage,
            exchange: this.exchange
          });
        }
      }

      // Reset connection and channel
      this.connection = null;
      this.channel = null;

      // Create new connection
      this.connection = await amqp.connect(this.host);

      // Setup connection event handlers
      this.connection.on('error', (err) => {
        this.logError('RabbitMQ connection error', {
          error: err?.message || String(err) || 'Unknown error',
          stack: err?.stack,
          exchange: this.exchange
        });
        this.connectionClosedByServer = true;
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        this.logWarn('RabbitMQ connection closed', {
          exchange: this.exchange
        });
        this.connectionClosedByServer = true;
        this.handleConnectionClose();
      });

      // Create channel
      if (this.connection) {
        this.channel = await this.connection.createChannel();

        // Setup channel event handlers
        if (this.channel) {
          this.channel.on('error', (err) => {
            this.logError('RabbitMQ channel error', {
              error: err?.message || String(err) || 'Unknown error',
              stack: err?.stack,
              exchange: this.exchange
            });
            this.handleChannelError();
          });

          this.channel.on('close', () => {
            this.logWarn('RabbitMQ channel closed', {
              exchange: this.exchange
            });
            this.handleChannelClose();
          });

          // Assert exchange
          await this.channel.assertExchange(this.exchange, 'direct', { durable: true });
        }
      }

      // Reset reconnection state
      this.isReconnecting = false;
      this.reconnectAttempts = 0;

      this.logInfo('RabbitMQ client connected successfully', {
        exchange: this.exchange
      });

      // Start heartbeat to keep connection alive
      this.startHeartbeat();
    } catch (error) {
      this.logError('Failed to connect to RabbitMQ', {
        error: error instanceof Error ? error.message : String(error) || 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        exchange: this.exchange
      });
      throw error;
    }
  }

  private async handleConnectionError(): Promise<void> {
    // Stop heartbeat when connection error occurs
    this.stopHeartbeat();

    if (!this.isReconnecting) {
      await this.scheduleReconnect();
    }
  }

  private async handleConnectionClose(): Promise<void> {
    // Stop heartbeat when connection is closed
    this.stopHeartbeat();

    this.channel = null;
    this.consumerTag = null;
    this.consumerSetupPromise = null;

    if (!this.isReconnecting) {
      await this.scheduleReconnect();
    }
  }

  private async handleChannelError(): Promise<void> {
    this.channel = null;
    this.consumerTag = null;
    this.consumerSetupPromise = null;

    if (this.connection && !this.isReconnecting) {
      await this.scheduleReconnect();
    }
  }

  private async handleChannelClose(): Promise<void> {
    this.channel = null;
    this.consumerTag = null;
    this.consumerSetupPromise = null;

    if (this.connection && !this.isReconnecting) {
      await this.scheduleReconnect();
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.logError(`Max reconnection attempts reached. Stopping reconnection`, {
        maxAttempts: this.maxReconnectAttempts,
        exchange: this.exchange
      });
      this.isReconnecting = false;
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    this.logInfo(`Scheduling RabbitMQ reconnection attempt`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay,
      exchange: this.exchange
    });

    setTimeout(async () => {
      try {
        await this.connect();
        // Re-setup consumer if we had one
        if (this.eventHandlers.size > 0) {
          await this.setupConsumer();
        }
      } catch (error) {
        this.logError('Reconnection failed', {
          error: error instanceof Error ? error.message : String(error) || 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          exchange: this.exchange
        });
        await this.scheduleReconnect();
      }
    }, delay);
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connection || !this.channel) {
      if (!this.isInitialized) {
        throw new Error("RabbitMQ client not initialized. Call init() first.");
      }

      if (this.isReconnecting) {
        throw new Error("RabbitMQ client is reconnecting. Please try again later.");
      }

      await this.connect();
    }
  }

  async publishIntegrationEvent(event: RabbitMqEventBase): Promise<void> {
    await this.ensureConnection();

    if (!this.channel) {
      throw new Error("RabbitMQ channel not available");
    }

    try {
      this.channel.publish(this.exchange, event.name, Buffer.from(JSON.stringify(event)));
      this.logDebug('Event published successfully', {
        eventName: event.name,
        exchange: this.exchange
      });
    } catch (error) {
      this.logError('Failed to publish event', {
        error: error instanceof Error ? error.message : String(error) || 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        eventName: event.name,
        exchange: this.exchange
      });
      throw error;
    }
  }

  private async setupConsumer() {
    // If we already have a consumer setup in progress, wait for it
    if (this.consumerSetupPromise) {
      return this.consumerSetupPromise;
    }

    // If we already have a consumer, no need to setup another one
    if (this.consumerTag) {
      return;
    }

    // Create a new setup promise
    this.consumerSetupPromise = (async () => {
      try {
        await this.ensureConnection();

        if (!this.channel) {
          throw new Error("RabbitMQ channel not available");
        }

        // Create queue if not exists
        if (!this.queueName) {
          const queue = await this.channel.assertQueue(
            this.queueConfig?.name ?? '',
            {
              exclusive: this.queueConfig?.exclusive ?? false,
              durable: this.queueConfig?.durable ?? true,
              autoDelete: this.queueConfig?.autoDelete ?? false,
              arguments: {
                ...this.queueConfig?.arguments,
                'x-queue-type': 'quorum',
                'x-ha-policy': 'all'
              }
            }
          );
          this.queueName = queue.queue;
          this.logInfo('Queue created/asserted', {
            queueName: this.queueName,
            exchange: this.exchange
          });
        }

        // Setup consumer only if we don't have one
        if (!this.consumerTag) {
          const { consumerTag } = await this.channel.consume(
            this.queueName,
            async (msg) => {
              if (msg) {
                try {
                  const routingKey = msg.fields.routingKey;
                  const eventContent = JSON.parse(msg.content.toString());
                  const handlers = this.eventHandlers.get(routingKey) || [];

                  this.logDebug('Processing message', {
                    routingKey,
                    queueName: this.queueName,
                    exchange: this.exchange
                  });

                  // Execute all handlers for this routing key
                  await Promise.all(handlers.map(handler => handler(eventContent)));

                  this.channel?.ack(msg);
                  this.logDebug('Message processed successfully', {
                    routingKey,
                    queueName: this.queueName,
                    exchange: this.exchange
                  });
                } catch (error) {
                  this.logError('Error processing message', {
                    error: error instanceof Error ? error.message : String(error) || 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    routingKey: msg.fields.routingKey,
                    queueName: this.queueName,
                    exchange: this.exchange
                  });
                  // Reject the message to prevent infinite retries
                  this.channel?.nack(msg, false, false);
                }
              }
            },
            { noAck: false }
          );

          this.consumerTag = consumerTag;
          this.logInfo('Consumer setup completed', {
            consumerTag,
            queueName: this.queueName,
            exchange: this.exchange
          });
        }

        // Re-bind all routing keys
        for (const routingKey of this.eventHandlers.keys()) {
          if (this.queueName && this.channel) {
            await this.channel.bindQueue(this.queueName, this.exchange, routingKey);
            this.logDebug('Routing key bound', {
              routingKey,
              queueName: this.queueName,
              exchange: this.exchange
            });
          }
        }
      } finally {
        // Clear the setup promise
        this.consumerSetupPromise = null;
      }
    })();

    return this.consumerSetupPromise;
  }

  async registerEventHandler<TEvent>(routingKey: string, handler: (eventContent: TEvent) => Promise<void>): Promise<void> {
    await this.ensureConnection();

    // Add handler to the map
    const handlers = this.eventHandlers.get(routingKey) || [];
    handlers.push(handler);
    this.eventHandlers.set(routingKey, handlers);

    this.logInfo('Event handler registered', {
      routingKey,
      handlerCount: handlers.length,
      exchange: this.exchange
    });

    // Setup consumer if not already done
    await this.setupConsumer();

    // Bind queue to routing key if not already bound
    if (this.queueName && this.channel) {
      await this.channel.bindQueue(this.queueName, this.exchange, routingKey);
    }
  }

  // For backward compatibility
  async handleIntegrationEvent<TEvent>(routingKey: string, handler: (eventContent: TEvent) => Promise<void>): Promise<void> {
    await this.registerEventHandler(routingKey, handler);
  }

  async close(): Promise<void> {
    this.isReconnecting = false;

    // Stop heartbeat first
    this.stopHeartbeat();

    if (this.consumerTag && this.channel) {
      try {
        await this.channel.cancel(this.consumerTag);
        this.logInfo('Consumer canceled', {
          consumerTag: this.consumerTag,
          exchange: this.exchange
        });
      } catch (error) {
        this.logWarn('Error canceling consumer', {
          error: error instanceof Error ? error.message : String(error) || 'Unknown error',
          consumerTag: this.consumerTag,
          exchange: this.exchange
        });
      }
      this.consumerTag = null;
    }

    if (this.channel) {
      try {
        await this.channel.close();
        this.logInfo('Channel closed', {
          exchange: this.exchange
        });
      } catch (error) {
        this.logWarn('Error closing channel', {
          error: error instanceof Error ? error.message : String(error) || 'Unknown error',
          exchange: this.exchange
        });
      }
      this.channel = null;
    }

    if (this.connection && !this.connectionClosedByServer) {
      try {
        await this.connection.close();
        this.logInfo('Connection closed', {
          exchange: this.exchange
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
        this.logWarn('Error closing connection (this is normal if connection was already closed)', {
          error: errorMessage,
          exchange: this.exchange
        });
      }
      this.connection = null;
    }

    this.isInitialized = false;
    this.logInfo('RabbitMQ client closed', {
      exchange: this.exchange
    });
  }
}