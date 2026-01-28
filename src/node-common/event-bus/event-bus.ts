import { EventEmitter } from "events";
import type { EventBusEventBase, RequestEventBase } from "./models";

type EventClass<T> = { new (...args: any[]): T };
type RequestHandler<T, R> = (event: T) => Promise<R> | R;

const REQUEST_PREFIX = "request:";
const REQUEST_MULTI_PREFIX = "request-multi:";

/** Event bus implementation built on top of EventEmitter with request-response support */
export class EventBus extends EventEmitter {
  constructor() {
    super();
    // Allow unlimited listeners per event type
    this.setMaxListeners(0);
  }

  /**
   * Get consistent event key from class
   */
  private getEventKey<T extends EventBusEventBase>(eventClass: EventClass<T>): string {
    return eventClass.name;
  }

  /**
   * Subscribe to an event (fire-and-forget, multiple listeners allowed)
   */
  subscribe<T extends EventBusEventBase>(
    eventClass: EventClass<T>,
    listener: (event: T) => void
  ): void {
    this.on(this.getEventKey(eventClass), listener);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe<T extends EventBusEventBase>(
    eventClass: EventClass<T>,
    listener: (event: T) => void
  ): void {
    this.off(this.getEventKey(eventClass), listener);
  }

  /**
   * Publish an event to all subscribers (fire-and-forget)
   */
  publish<T extends EventBusEventBase>(event: T): void {
    this.emit(event.constructor.name, event);
  }

  // ============================================
  // Single-handler request-response (strict)
  // ============================================

  /**
   * Register a handler for request-response events (single handler mode).
   * Only ONE handler per event type is allowed.
   * @throws Error if a handler is already registered for this event type
   */
  onRequest<T extends RequestEventBase<R>, R>(
    eventClass: EventClass<T>,
    handler: RequestHandler<T, R>
  ): void {
    const eventKey = REQUEST_PREFIX + this.getEventKey(eventClass);
    const existingCount = this.listenerCount(eventKey);

    if (existingCount > 0) {
      throw new Error(
        `Handler already registered for event type: ${eventClass.name}. ` +
          `Only one request handler per event type is allowed. ` +
          `Use onRequestMulti/requestAll for multiple handlers.`
      );
    }

    this.on(eventKey, handler);
  }

  /**
   * Remove a single-mode request handler
   */
  offRequest<T extends RequestEventBase<R>, R>(
    eventClass: EventClass<T>,
    handler: RequestHandler<T, R>
  ): void {
    const eventKey = REQUEST_PREFIX + this.getEventKey(eventClass);
    this.off(eventKey, handler);
  }

  /**
   * Send a request event and wait for the response from the single registered handler.
   * @throws Error if no handler is registered or timeout is exceeded
   */
  async request<T extends RequestEventBase<R>, R>(event: T): Promise<R> {
    const eventKey = REQUEST_PREFIX + event.constructor.name;
    const handlers = this.listeners(eventKey) as RequestHandler<T, R>[];

    if (handlers.length === 0) {
      throw new Error(`No handler registered for event type: ${event.constructor.name}`);
    }

    // This should never happen due to onRequest validation, but safety check
    if (handlers.length > 1) {
      throw new Error(
        `Multiple handlers registered for event type: ${event.constructor.name}. ` +
          `Only one handler is allowed. Use requestAll for multiple handlers.`
      );
    }

    const handler = handlers[0];
    const promise = Promise.resolve(handler(event));

    if (event.timeout && event.timeout > 0) {
      return this.withTimeout(promise, event.timeout, event.constructor.name);
    }

    return promise;
  }

  /**
   * Check if a single-mode handler is registered for a request event type
   */
  hasRequestHandler<T extends RequestEventBase<R>, R>(eventClass: EventClass<T>): boolean {
    const eventKey = REQUEST_PREFIX + this.getEventKey(eventClass);
    return this.listenerCount(eventKey) > 0;
  }

  // ============================================
  // Multi-handler request-response (aggregation)
  // ============================================

  /**
   * Register a handler for request-response events (multi handler mode).
   * Multiple handlers are allowed - useful for validation aggregation patterns.
   */
  onRequestMulti<T extends RequestEventBase<R>, R>(
    eventClass: EventClass<T>,
    handler: RequestHandler<T, R>
  ): void {
    const eventKey = REQUEST_MULTI_PREFIX + this.getEventKey(eventClass);
    this.on(eventKey, handler);
  }

  /**
   * Remove a multi-mode request handler
   */
  offRequestMulti<T extends RequestEventBase<R>, R>(
    eventClass: EventClass<T>,
    handler: RequestHandler<T, R>
  ): void {
    const eventKey = REQUEST_MULTI_PREFIX + this.getEventKey(eventClass);
    this.off(eventKey, handler);
  }

  /**
   * Send a request event and wait for responses from ALL registered handlers.
   * Returns an array of all responses (useful for validation aggregation).
   * @returns Array of responses from all handlers, empty array if no handlers
   */
  async requestAll<T extends RequestEventBase<R>, R>(event: T): Promise<R[]> {
    const eventKey = REQUEST_MULTI_PREFIX + event.constructor.name;
    const handlers = this.listeners(eventKey) as RequestHandler<T, R>[];

    if (handlers.length === 0) {
      return [];
    }

    const promises = handlers.map((handler) => Promise.resolve(handler(event)));

    if (event.timeout && event.timeout > 0) {
      return this.withTimeout(Promise.all(promises), event.timeout, event.constructor.name);
    }

    return Promise.all(promises);
  }

  /**
   * Check if any multi-mode handlers are registered for a request event type
   */
  hasRequestMultiHandlers<T extends RequestEventBase<R>, R>(eventClass: EventClass<T>): boolean {
    const eventKey = REQUEST_MULTI_PREFIX + this.getEventKey(eventClass);
    return this.listenerCount(eventKey) > 0;
  }

  /**
   * Get the count of multi-mode handlers registered for a request event type
   */
  getRequestMultiHandlerCount<T extends RequestEventBase<R>, R>(eventClass: EventClass<T>): number {
    const eventKey = REQUEST_MULTI_PREFIX + this.getEventKey(eventClass);
    return this.listenerCount(eventKey);
  }

  // ============================================
  // Private helpers
  // ============================================

  /**
   * Wrap a promise with a timeout that properly cleans up
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, eventType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Request timeout after ${timeoutMs}ms for event type: ${eventType}`));
        }
      }, timeoutMs);

      promise
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        });
    });
  }
}