export interface Logger {
  trace(message: string, data?: any): void;
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, err: Error, data?: any): void;
}

export interface ScopedLogger extends Logger {
  // Provides backward compatibility with the old seq-logger interface
}