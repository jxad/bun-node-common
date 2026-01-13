export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags?: number;
  traceState?: string;
}

export interface TraceHeaders {
  [key: string]: string;
}