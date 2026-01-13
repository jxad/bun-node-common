import { SeqTransport } from '@datalust/winston-seq';
import winston from 'winston';
import { ScopedLogger } from './interfaces';
import { TraceContextStore } from './tracing';
import { LogLevel } from './types';

export interface LoggerFactoryOptions {
  applicationName: string;
  instanceId: string;
  seqServerUrl: string;
  seqApiKey?: string;
  logLevel?: LogLevel;
}

export class LoggerFactory {
  private readonly logger: winston.Logger;
  private readonly traceStore: TraceContextStore;

  constructor(options: LoggerFactoryOptions) {
    const {
      applicationName,
      instanceId,
      seqServerUrl,
      seqApiKey,
      logLevel = 'info'
    } = options;

    this.traceStore = new TraceContextStore();

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.simple(),
      })
    ];

    // Only add Seq transport if API key is provided
    if (seqApiKey) {
      transports.push(
        new SeqTransport({
          serverUrl: seqServerUrl,
          apiKey: seqApiKey,
          onError: (e => { console.error(e) }),
          handleExceptions: true,
          handleRejections: true,
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.timestamp(),
        winston.format.json(),
      ),
      defaultMeta: {
        application: applicationName,
        instanceId: instanceId
      },
      transports
    });
  }

  forClass(instance: object): ScopedLogger {
    const className = instance.constructor.name;
    return this.current(className);
  }

  current(scope: string): ScopedLogger {
    const childLogger = this.logger.child({
      scope: scope
    });
    return new LoggerWrapper(childLogger, this.traceStore);
  }

  /**
   * Get the shared trace context store for tracing propagation
   */
  getTraceContextStore(): TraceContextStore {
    return this.traceStore;
  }
}

// For backward compatibility
export const SeqLoggerFactory = LoggerFactory;

class LoggerWrapper implements ScopedLogger {
  constructor(
    private readonly winstonLogger: winston.Logger,
    private readonly traceStore: TraceContextStore
  ) { }

  private enrichWithTrace(data?: any): any {
    const traceContext = this.traceStore.current();
    if (!traceContext) {
      return data;
    }

    return {
      ...data,
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId
    };
  }

  trace(message: string, data?: any): void {
    this.winstonLogger.silly(message, this.enrichWithTrace(data));
  }

  debug(message: string, data?: any): void {
    this.winstonLogger.debug(message, this.enrichWithTrace(data));
  }

  info(message: string, data?: any): void {
    this.winstonLogger.info(message, this.enrichWithTrace(data));
  }

  warn(message: string, data?: any): void {
    this.winstonLogger.warn(message, this.enrichWithTrace(data));
  }

  error(message: string, err: Error, data?: any): void {
    this.winstonLogger.error(message, this.enrichWithTrace({
      error: err.message,
      stack: err.stack,
      ...data
    }));
  }
}