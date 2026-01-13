export interface EventBusEventBase {
  /** The type of the event. Usually the class name */
  type: string;
}

/** Event that expects a response */
export interface RequestEventBase<TResponse = any> extends EventBusEventBase {
  /** Optional timeout in milliseconds for waiting response */
  timeout?: number;
}