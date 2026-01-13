import { LoggerFactory } from "../logger";

/** Options for the polling task scheduler */
export interface PollingTaskOptions {
  /** Max number of executions before stopping the task */
  maxExecutions?: number;

  /** SEQ Logger used for logging purposes */
  loggerFactory?: LoggerFactory;
}
