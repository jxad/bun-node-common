import type { RabbitMqEventBase } from "./types";

export interface IRabbitMqClient {
  /** Initialize the RabbitMQ client */
  init(): Promise<void>;

  /** Publish an integration event to RabbitMQ.
   * N.B. Publishes should always be in try-catch blocks to handle network errors
   * @param event The event to publish
   */
  publishIntegrationEvent(event: RabbitMqEventBase): Promise<void>;

  /** Register a handler for an integration event.
   * N.B. Handlers should always be in try-catch blocks to handle network errors
   * @param routingKey The routing key to bind the handler to
   * @param handler The handler for the event
   */
  registerEventHandler<TEvent>(routingKey: string, handler: (eventContent: TEvent) => Promise<void>): Promise<void>

  /** Register a handler for an integration event.
   * N.B. Handlers should always be in try-catch blocks to handle network errors
   * @deprecated Use registerEventHandler instead. This method is kept for backward compatibility.
   * @param routingKey The routing key to bind the handler to
   * @param handler The handler for the event
   */
  handleIntegrationEvent<TEvent>(routingKey: string, handler: (eventContent: TEvent) => Promise<void>): Promise<void>;
}