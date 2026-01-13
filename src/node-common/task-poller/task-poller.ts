import { Logger } from "../logger";
import type { PollingTaskOptions } from "./models";

const DEFAULT_POLLING_INTERVAL = 10000; // 10s

/** Utility class for scheduling polling tasks */
export class TaskPoller<T> {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private executionCount: number = 0;
  private maxExecutions: number | null;
  private logger?: Logger;

  /**
   * Utility class for scheduling polling tasks
   * @param task The async task to execute
   * @param interval The interval in milliseconds between each task execution (default: 10s)
   * @param onError Callback for task errors
   * @param options Additional options
   */
  constructor(
    private readonly taskName: string,
    private task: () => Promise<T>,
    private interval: number = DEFAULT_POLLING_INTERVAL,
    private onError?: (error: any) => void,
    options: PollingTaskOptions = {}
  ) {
    this.maxExecutions = options.maxExecutions ?? null; //if null, run indefinitely
    this.logger = options.loggerFactory?.forClass(this);
  }

  /** Starts the task execution */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.executionCount = 0;

    this.intervalId = setInterval(async () => {
      if (this.maxExecutions !== null && this.executionCount >= this.maxExecutions) {
        this.stop();
        this.logInfo(`Task ${this.taskName} completed after ${this.executionCount} executions.`);
        return;
      }

      try {
        this.logSilly(`Executing task ${this.taskName} (#${this.executionCount + 1})...`);
        await this.task();
        this.executionCount++;
      } catch (error) {
        this.logError(`Error during task ${this.taskName} execution`, error as Error);
        if (this.onError) {
          this.onError(error);
        }
      }
    }, this.interval);
  }

  /** Stops the task */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logInfo(`Task ${this.taskName} stopped`);
  }

  /** Returns whether the task is running */
  isTaskRunning(): boolean {
    return this.isRunning;
  }

  /** Returns the number of task executions */
  getExecutionCount(): number {
    return this.executionCount;
  }

  /** Logs a silly message */
  private logSilly(message: string) {
    if (this.logger) {
      this.logger.trace(
        message
      );
    } else {
      console.log(message);
    }
  }

  /** Logs an info message */
  private logInfo(message: string) {
    if (this.logger) {
      this.logger.info(
        message
      );
    } else {
      console.log(message);
    }
  }

  /** Logs an error message */
  private logError(message: string, error: Error): void {
    if (this.logger) {
      this.logger.error(
        message,
        error
      );
    } else {
      console.error(message, error);
    }
  }

}