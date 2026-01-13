export interface ActionError {
  code: string;
  message: string;
  stack?: string;
}

export class ActionResponse<TResponseData> {
  /**
   * Creates an instance of ActionSuccessResponse.
   * @param requestId Unique identifier for the request
   * @param data The response data
   */
  constructor(
    readonly requestId: string,
    readonly status: number,
    readonly data?: TResponseData,
    readonly uiMessage?: string,
    readonly errors?: ActionError[]
  ) {}
}
