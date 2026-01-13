import { type ScopedLogger, LoggerFactory } from "../logger";

export abstract class Job {
  private intervalId: NodeJS.Timeout | null = null;
  private logger: ScopedLogger;

  /** Initializes a new instance of the JobBase class.
   * @param intervalMs The interval in milliseconds at which the job should be executed.
   * @param loggerFactory The logger factory to create scoped loggers.
   */
  constructor(
    private readonly intervalMs: number,
    loggerFactory: LoggerFactory
  ) { 
    this.logger = loggerFactory.forClass(this);
  }

  abstract name: string;

  start(): void {
    if (this.intervalId) {
      this.logger.warn("Cannot start job, it is already running");
      return;
    }

    this.intervalId = setInterval(async () => await this.execute(), this.intervalMs);
  }

  stop(): void {
    if (!this.intervalId) {
      this.logger.warn("Cannot stop job, it is not running");
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  abstract execute(): Promise<void>;
}