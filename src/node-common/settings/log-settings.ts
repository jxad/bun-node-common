import type { LogLevel } from "../logger"

export interface SeqSettings {
  /** Endpoint of the SEQ server collecting logs */
  url: string

  /** API key to allow the application to send logs to SEQ */
  apiKey: string

  /** Name of the application */
  applicationName: string

  /** ID of the service Instance */
  instanceId: string

  /** SEQ logger level */
  loggerLevel?: LogLevel
}

export interface LogSettings {
  seq: SeqSettings
}