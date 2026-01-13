export interface RabbitMqEventBase {
  /** The name of the event, used as routing key */
  name: string
}

export interface QueueConfig {
  name?: string;
  exclusive?: boolean;
  durable?: boolean;
  autoDelete?: boolean;
  arguments?: any;
}