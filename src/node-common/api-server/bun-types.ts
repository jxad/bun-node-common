// BunApiServer specific types

export interface BunApiServerRequest {
  // Core properties
  body: any;
  params: { [key: string]: string };
  query: { [key: string]: any };
  headers: { [key: string]: string | string[] | undefined };
  method: string;
  url: string;
  path: string;
  ip: string;

  // Commonly used methods
  get(name: string): string | undefined;
  header(name: string): string | string[] | undefined;

  // Custom properties
  log?: any; // For logger
  user?: any; // For auth middleware

  // Add other specific properties here if needed
  [key: string]: any;
}

export interface BunApiServerResponse {
  // Status and response methods
  status(code: number): BunApiServerResponse;
  send(body: any): BunApiServerResponse;
  json(body: any): BunApiServerResponse;

  // Headers
  set(field: string, value: string | string[]): BunApiServerResponse;
  header(field: string, value: string | string[]): BunApiServerResponse;
  get(field: string): string | undefined;

  // Redirect methods
  redirect(url: string): BunApiServerResponse;
  redirect(status: number, url: string): BunApiServerResponse;

  // Properties
  statusCode: number;
  headersSent: boolean;

  // Internal method to get the Bun Response
  _getResponse(): Response;

  // Add other specific properties here if needed
  [key: string]: any;
}

// Forward declaration to avoid circular dependency
export interface BunApiServerInterface {
  defineGetRoute(path: string, handler: BunRouteHandler): void;
  definePostRoute(path: string, handler: BunRouteHandler): void;
  defineDeleteRoute(path: string, handler: BunRouteHandler): void;
  definePutRoute(path: string, handler: BunRouteHandler): void;
  definePatchRoute(path: string, handler: BunRouteHandler): void;
}

// Types for Bun controllers and middleware
export type BunRouteHandler = (req: BunApiServerRequest, res: BunApiServerResponse) => void | Promise<void>;
export type BunControllerRegistrar = (api: BunApiServerInterface) => void;
export type BunMiddleware = (req: BunApiServerRequest, res: BunApiServerResponse, next: () => Promise<void>) => Promise<void | Response>;
