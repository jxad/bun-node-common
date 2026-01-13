
import type { EventBusEventBase, RequestEventBase } from "./models";

type SyncHandler<T> = (event: T) => void;
type AsyncHandler<T, R> = (event: T) => Promise<R> | R;

/** Simple event bus implementation with request-response support */
export class EventBus {
  private subscribers: Map<string, Set<SyncHandler<EventBusEventBase>>>;
  private requestHandlers: Map<string, Set<AsyncHandler<any, any>>>;

  constructor() {
    this.subscribers = new Map();
    this.requestHandlers = new Map();
  }

  subscribe<T extends EventBusEventBase>(
    eventClass: { new(...args: any[]): T },
    listener: (event: T) => void
  ): void {
    const eventName = eventClass.name;
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    this.subscribers.get(eventName)!.add(listener as SyncHandler<EventBusEventBase>);
  }

  unsubscribe<T extends EventBusEventBase>(
    eventClass: { new(...args: any[]): T },
    listener: (event: T) => void
  ): void {
    const eventType = eventClass.prototype.type;
    const listeners = this.subscribers.get(eventType);
    if (listeners) {
      listeners.delete(listener as SyncHandler<EventBusEventBase>);
      if (listeners.size === 0) {
        this.subscribers.delete(eventType);
      }
    }
  }

  publish<T extends EventBusEventBase>(event: T): void {
    const eventType = event.type;
    const listeners = this.subscribers.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Register a handler for request-response events
   * Handlers can return a value synchronously or asynchronously
   */
  onRequest<T extends RequestEventBase<R>, R>(
    eventClass: { new(...args: any[]): T },
    handler: (event: T) => Promise<R> | R
  ): void {
    const eventName = eventClass.name;
    if (!this.requestHandlers.has(eventName)) {
      this.requestHandlers.set(eventName, new Set());
    }
    this.requestHandlers.get(eventName)!.add(handler as AsyncHandler<any, any>);
  }

  /**
   * Remove a request handler
   */
  offRequest<T extends RequestEventBase<R>, R>(
    eventClass: { new(...args: any[]): T },
    handler: (event: T) => Promise<R> | R
  ): void {
    const eventName = eventClass.name;
    const handlers = this.requestHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler as AsyncHandler<any, any>);
      if (handlers.size === 0) {
        this.requestHandlers.delete(eventName);
      }
    }
  }

  /**
   * Publish a request event and wait for responses from all handlers
   * Returns an array of all responses
   * @throws Error if timeout is exceeded
   */
  async request<T extends RequestEventBase<R>, R>(event: T): Promise<R[]> {
    const eventType = event.type;
    const handlers = this.requestHandlers.get(eventType);
    
    if (!handlers || handlers.size === 0) {
      return [];
    }

    const promises = Array.from(handlers).map(handler => 
      Promise.resolve(handler(event))
    );

    // Handle timeout if specified
    if (event.timeout && event.timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${event.timeout}ms for event type: ${eventType}`));
        }, event.timeout);
      });

      return Promise.race([
        Promise.all(promises),
        timeoutPromise
      ]);
    }

    return Promise.all(promises);
  }

  /**
   * Publish a request event and wait for the first response
   * Useful when you expect only one handler or care about the first response
   * @throws Error if no handlers are registered or timeout is exceeded
   */
  async requestFirst<T extends RequestEventBase<R>, R>(event: T): Promise<R> {
    const eventType = event.type;
    const handlers = this.requestHandlers.get(eventType);
    
    if (!handlers || handlers.size === 0) {
      throw new Error(`No handlers registered for event type: ${eventType}`);
    }

    const handler = Array.from(handlers)[0];
    const promise = Promise.resolve(handler(event));

    // Handle timeout if specified
    if (event.timeout && event.timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${event.timeout}ms for event type: ${eventType}`));
        }, event.timeout);
      });

      return Promise.race([promise, timeoutPromise]);
    }

    return promise;
  }

}