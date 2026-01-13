import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import type { TraceContext, TraceHeaders } from './types';

/**
 * Store for managing trace context across async operations
 */
export class TraceContextStore {
  private readonly asyncStorage = new AsyncLocalStorage<TraceContext>();

  /**
   * Get current trace context
   */
  current(): TraceContext | undefined {
    return this.asyncStorage.getStore();
  }

  /**
   * Run function with provided trace context
   */
  run<T>(context: TraceContext, fn: () => T): T {
    return this.asyncStorage.run(context, fn);
  }

  /**
   * Generate a new trace context
   */
  generate(parentSpanId?: string): TraceContext {
    return {
      traceId: this.generateId(),
      spanId: this.generateId(),
      parentSpanId,
      flags: 1
    };
  }

  private generateId(): string {
    return randomBytes(8).toString('hex');
  }
}

/**
 * Propagator for distributing trace context through HTTP headers
 */
export class TracingPropagator {
  private static readonly TRACE_PARENT_HEADER = 'traceparent';
  private static readonly TRACE_STATE_HEADER = 'tracestate';

  constructor(private readonly contextStore: TraceContextStore) {}

  /**
   * Extract trace context from incoming HTTP headers
   */
  extractFromHeaders(headers: Record<string, string | string[] | undefined>): TraceContext | undefined {
    const traceparent = this.getHeaderValue(headers, TracingPropagator.TRACE_PARENT_HEADER);
    if (!traceparent) {
      return undefined;
    }

    const tracestate = this.getHeaderValue(headers, TracingPropagator.TRACE_STATE_HEADER);
    return this.parseTraceParent(traceparent, tracestate);
  }

  /**
   * Build headers for outbound HTTP requests with current trace context
   */
  buildOutboundHeaders(): TraceHeaders {
    const context = this.contextStore.current();
    if (!context) {
      return {};
    }

    const headers: TraceHeaders = {
      [TracingPropagator.TRACE_PARENT_HEADER]: this.formatTraceParent(context)
    };

    if (context.traceState) {
      headers[TracingPropagator.TRACE_STATE_HEADER] = context.traceState;
    }

    return headers;
  }

  private getHeaderValue(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
    const value = headers[key.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private parseTraceParent(traceparent: string, tracestate?: string): TraceContext | undefined {
    // Format: version-traceId-spanId-flags
    const parts = traceparent.split('-');
    if (parts.length !== 4) {
      return undefined;
    }

    const [version, traceId, spanId, flags] = parts;
    if (version !== '00' || !traceId || !spanId) {
      return undefined;
    }

    return {
      traceId,
      spanId,
      flags: parseInt(flags || '01', 16),
      traceState: tracestate
    };
  }

  private formatTraceParent(context: TraceContext): string {
    const flags = (context.flags || 1).toString(16).padStart(2, '0');
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }
}
