import { Job } from ".";
import { type ScopedLogger, LoggerFactory } from "../logger";

export class JobScheduler {
  private jobs: Job[] = [];
  private logger: ScopedLogger;

  /** Initializes a new instance of the JobScheduler class.
   * @param loggerFactory The logger factory to create scoped loggers.
   */
  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.forClass(this);
  }

  public addJob(job: Job): void {
    this.jobs.push(job);
  }

  public startAll(): void {
    for (const job of this.jobs) {
      job.start();

      this.logger.info(`Job ${job.name} started`);
    }
  }

  public stopAll(): void {
    for (const job of this.jobs) {
      job.stop();

      this.logger.info(`Job ${job.name} stopped`);
    }
  }
}
