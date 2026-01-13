import { v1 } from "uuid";
import { Jwt } from "../jwt";
import type { ActionOptions } from "./action-options";
import { ActionError, ActionResponse } from "./action-response";
import { ResponseCodes } from "./action-response-codes";

/** Base class used to build queries or commands that can be executed by the application. */
export abstract class ActionBase<TReq, TResponseData> {
  /** The action request class */
  private reqCtor: {
    new (...args: any[]): TReq;
    validate(obj: TReq): string[] | undefined;
  };
  /** The action options */
  private options: ActionOptions = {
    badRequestOnMissingParameters: true,
    jwtSecret: undefined,
    enableJwtValidation: false,
  };

  /** Express request object */
  protected req: TReq;
  /** The request's headers */
  protected headers: Headers;
  /** The request's jwt. Undefined if jwt is missing from the authorization header */
  protected jwt?: string;
  /** Unique identifier for the request */
  protected requestId: string;
  /** List of missing request's required properties, if any */
  protected missingRequiredProperties: string[] = [];

  constructor(
    ctor: {
      new (...args: any[]): TReq;
      validate(obj: TReq): string[] | undefined;
    },
    req: TReq,
    headers: Headers
  ) {
    this.reqCtor = ctor;
    this.req = req;
    this.headers = headers;
    this.requestId = v1();
  }

  /** Executes the action */
  async execute(): Promise<ActionResponse<TResponseData>> {
    this.missingRequiredProperties = this.reqCtor.validate(this.req) ?? [];
    if (
      this.missingRequiredProperties &&
      this.missingRequiredProperties.length > 0 &&
      this.options.badRequestOnMissingParameters
    ) {
      return this.error(
        ResponseCodes.BAD_REQUEST,
        "MISSING_REQUIRED_FIELDS",
        `Missing required fields [${this.missingRequiredProperties.join(",")}]`,
        new Error(
          `Missing required fields [${this.missingRequiredProperties.join(
            ","
          )}]`
        )
      );
    }

    this.jwt = this.getJwtFromHeaders();

    if (this.options.enableJwtValidation) {
      if (this.options.jwtSecret === undefined) {
        throw new Error("jwt secret is required to enable jwt validation");
      }

      if (!this.jwt) {
        return this.error(
          ResponseCodes.UNAUTHORIZED,
          "MISSING_JWT",
          `Missing jwt`,
          new Error("Missing jwt")
        );
      }

      const isValid = this.verifyJwt();
      if (!isValid) {
        return this.error(
          ResponseCodes.UNAUTHORIZED,
          "INVALID_JWT",
          `Invalid jwt`,
          new Error("Invalid jwt")
        );
      }
    }

    return await this.executeImpl();
  }

  /** Sets the options for the action */
  protected setOptions(options: ActionOptions) {
    this.options = { ...this.options, ...options };
  }

  /** Send success response
   * @param data The data to be included in the response
   * @returns The response object
   */
  protected success(data: TResponseData): ActionResponse<TResponseData> {
    return new ActionResponse<TResponseData>(
      this.requestId,
      ResponseCodes.OK,
      data
    );
  }

  /** Send error response
   * @param status The HTTP status code. Default 500
   * @param code The error code
   * @param uiMessage The user friendly error message
   * @param error The original error, if any
   * @returns The response object
   */
  protected error(
    status: number = ResponseCodes.INTERNAL_SERVER_ERROR,
    code: string,
    uiMessage: string,
    error?: Error
  ): ActionResponse<TResponseData> {
    return new ActionResponse<TResponseData>(
      this.requestId,
      status,
      undefined,
      uiMessage,
      [
        {
          code: code,
          message: error?.message ?? "An unknown error occurred",
          stack: error?.stack,
        },
      ]
    );
  }

  /** Send error response with errors
   * @param status The HTTP status code. Default 500
   * @param uiMessage The user friendly error message
   * @param errors The errors to be included in the response
   * @returns The response object
   */
  protected errorWithErrors(
    status: number = ResponseCodes.INTERNAL_SERVER_ERROR,
    uiMessage: string,
    errors: ActionError[]
  ): ActionResponse<TResponseData> {
    return new ActionResponse<TResponseData>(
      this.requestId,
      status,
      undefined,
      uiMessage,
      errors
    );
  }

  /** Extract the JWT from the headers
   * n.b. The headers must contain the "authorization" field, case sensitive
   * @param keepBearer If true, the method will return the JWT with the "Bearer " prefix. Default false
   * @returns The JWT token
   */
  protected getJwtFromHeaders = (
    keepBearerPrefix: boolean = false
  ): string | undefined => {
    const authHeader = this.headers.get("authorization");

    if (keepBearerPrefix) return authHeader ?? undefined;

    return authHeader?.replace("Bearer ", "");
  };

  /** Verify jwt
   * @returns True if the token is valid, false otherwise
   */
  protected verifyJwt(): boolean {
    if (!this.options.jwtSecret || !this.jwt) return false;
    const jwt = new Jwt(this.options.jwtSecret);
    return jwt.verify(this.jwt);
  }

  /** Extract payload from the jwt. The payload is deserialized to an object of type T.
   * If validate is true and token is not valid, the method will thrown an error
   * @param jwtHash The JWT hash to extract the payload from
   * @param validate If true, is going to validate the JWT before extracting the payload. Default false
   * @param secret Used to check if the token is valid. If provided is going to ignore the one specified during module initialization
   * @returns The payload of the JWT
   * @throws Error if the token is not valid and validate is true
   */
  protected getJwtPayload<T>(
    validate: boolean = false,
    secret?: string
  ): T | undefined {
    if (!this.jwt) return undefined;

    const jwt = new Jwt(secret);
    return JSON.parse(
      jwt.getPayload(this.jwt, validate, secret) as string
    ) as T;
  }

  /** Core logic of the action, to be implemented by the derived class */
  protected abstract executeImpl(): Promise<ActionResponse<TResponseData>>;
}
