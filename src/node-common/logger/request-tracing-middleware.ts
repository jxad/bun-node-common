import type { ScopedLogger } from './interfaces';
import type { TraceContext } from './types';
import { TraceContextStore, TracingPropagator } from './tracing';

export interface TracingData {
  context: TraceContext;
  log: ScopedLogger;
}

/**
 * Middleware for handling request tracing in HTTP servers
 */
export class RequestTracingMiddleware {
  private readonly contextStore: TraceContextStore;
  private readonly propagator: TracingPropagator;

  constructor(
    private readonly loggerFactory: { current: (scope: string) => ScopedLogger },
    contextStore?: TraceContextStore
  ) {
    this.contextStore = contextStore || new TraceContextStore();
    this.propagator = new TracingPropagator(this.contextStore);
  }

  /**
   * Create a handler that extracts/generates trace context from request
   */
  handler() {
    return (req: Request): TracingData => {
      // Extract trace context from headers or generate new one
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      let context = this.propagator.extractFromHeaders(headers);
      if (!context) {
        context = this.contextStore.generate();
      } else {
        // Create new span for this request
        context = this.contextStore.generate(context.spanId);
      }

      // Create scoped logger with trace context
      const log = this.loggerFactory.current("HTTP");

      return { context, log };
    };
  }

  /**
   * Run function within trace context
   */
  runWithContext<T>(context: TraceContext, fn: () => T): T {
    return this.contextStore.run(context, fn);
  }

  /**
   * Log request completion with timing and response details
   */
  logRequestCompletion(tracingData: TracingData, response: Response): void {
    tracingData.log.trace("HTTP request completed", {
      status: response.status,
      traceId: tracingData.context.traceId,
      spanId: tracingData.context.spanId
    });
  }

  /**
   * Get the trace context store for external usage
   */
  getContextStore(): TraceContextStore {
    return this.contextStore;
  }

  /**
   * Get the tracing propagator for external usage
   */
  getPropagator(): TracingPropagator {
    return this.propagator;
  }
}
