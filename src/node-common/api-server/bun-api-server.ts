import type { ScopedLogger } from "../logger";
import { LoggerFactory, RequestTracingMiddleware } from "../logger";
import type { CorsSettings } from "./cors-settings";
import { DEFAULT_CORS_SETTINGS } from "./cors-settings";

// Inline types to avoid import issues
interface BunApiServerRequest {
  body: any;
  params: { [key: string]: string };
  query: { [key: string]: any };
  headers: { [key: string]: string | string[] | undefined };
  method: string;
  url: string;
  path: string;
  ip: string;
  get(name: string): string | undefined;
  header(name: string): string | string[] | undefined;
  log?: any;
  user?: any;
  [key: string]: any;
}

interface BunApiServerResponse {
  status(code: number): BunApiServerResponse;
  send(body: any): BunApiServerResponse;
  json(body: any): BunApiServerResponse;
  set(field: string, value: string | string[]): BunApiServerResponse;
  header(field: string, value: string | string[]): BunApiServerResponse;
  get(field: string): string | undefined;
  redirect(url: string): BunApiServerResponse;
  redirect(status: number, url: string): BunApiServerResponse;
  statusCode: number;
  headersSent: boolean;
  _getResponse(): Response;
  [key: string]: any;
}

type BunRouteHandler = (req: BunApiServerRequest, res: BunApiServerResponse) => void | Promise<void>;
type BunControllerRegistrar = (api: BunApiServer) => void;
type BunMiddleware = (req: BunApiServerRequest, res: BunApiServerResponse, next: () => Promise<void>) => Promise<void | Response>;

const DEFAULT_PORT = 3000;

interface Route {
  method: string;
  path: string;
  handler: BunRouteHandler;
  pathPattern?: RegExp;
  paramNames?: string[];
}

export class BunApiServer {
  private readonly port: number = DEFAULT_PORT;
  private readonly loggerFactory: LoggerFactory;
  private readonly logger: ScopedLogger;
  private readonly routes: Route[] = [];
  private readonly middlewares: BunMiddleware[] = [];
  private server?: any;

  // Configuration
  private corsSettings: CorsSettings = DEFAULT_CORS_SETTINGS;
  private errorHandler?: (err: Error, req: BunApiServerRequest, res: BunApiServerResponse) => Promise<Response> | Response;
  private tracingMiddleware?: RequestTracingMiddleware;

  constructor(
    loggerFactory: LoggerFactory,
    port: number = DEFAULT_PORT
  ) {
    this.port = port;
    this.loggerFactory = loggerFactory;
    this.logger = loggerFactory.forClass(this);
  }

  /**
   * Initializes the API server with controllers, middlewares, error handler, CORS settings, and request size limit.
   */
  init = (
    middlewares: BunMiddleware[] = [],
    errorHandler?: (err: Error, req: BunApiServerRequest, res: BunApiServerResponse) => Promise<Response> | Response,
    corsSettings: CorsSettings = DEFAULT_CORS_SETTINGS,
    _requestSizeLimitMb = 50,
    logRequests = true
  ) => {
    this.corsSettings = corsSettings;
    this.errorHandler = errorHandler;

    // Initialize tracing middleware with shared trace context store
    this.tracingMiddleware = new RequestTracingMiddleware(
      this.loggerFactory,
      this.loggerFactory.getTraceContextStore()
    );

    // Add request logging middleware if enabled
    if (logRequests) {
      this.middlewares.push(async (req: BunApiServerRequest, _res: BunApiServerResponse, next: () => Promise<void>) => {
        const time = new Date().toUTCString();
        this.logger.debug(`[${time}] [${req.method.toUpperCase()}] ${req.url}`);
        return next();
      });
    }

    // Add custom middlewares
    this.middlewares.push(...middlewares);
  };

  /** Starts the API server and listens on the configured port. */
  start = async () => {
    this.server = Bun.serve({
      port: this.port,
      fetch: this.handleRequest.bind(this),
    });

    this.logger.info(`API server started. listening on http://localhost:${this.port}`);
  };

  /** Stops the API server */
  stop = async () => {
    if (this.server) {
      this.server.stop();
      this.logger.info("API server stopped");
    }
  };

  private handleRequest = async (req: Request): Promise<Response> => {
    try {
      // Initialize tracing
      const tracingData = this.tracingMiddleware?.handler()(req);

      return await this.tracingMiddleware!.runWithContext(tracingData!.context, async () => {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          return this.handleCors(req);
        }

        // Parse request body
        const body = await this.parseRequestBody(req);

        // Create wrapped request and response
        const apiReq = await this.createApiRequest(req, body, tracingData!.log);
        const apiRes = this.createApiResponse();

        // Apply middlewares
        for (const middleware of this.middlewares) {
          const result = await middleware(apiReq, apiRes, () => Promise.resolve());
          if (result instanceof Response) {
            this.tracingMiddleware?.logRequestCompletion(tracingData!, result);
            return result;
          }
        }

        // Find and execute route
        const route = this.findRoute(req.method, new URL(req.url).pathname);
        if (!route) {
          const notFoundResponse = new Response('Not Found', { status: 404 });
          this.tracingMiddleware?.logRequestCompletion(tracingData!, notFoundResponse);
          return notFoundResponse;
        }

        // Extract route parameters
        if (route.pathPattern && route.paramNames) {
          const match = new URL(req.url).pathname.match(route.pathPattern);
          if (match) {
            route.paramNames.forEach((name, index) => {
              const paramValue = match[index + 1];
              if (paramValue) {
                apiReq.params[name] = paramValue;
              }
            });
          }
        }

        // Execute route handler
        await route.handler(apiReq, apiRes);

        const response = apiRes._getResponse();
        this.tracingMiddleware?.logRequestCompletion(tracingData!, response);

        // Apply CORS headers if enabled
        if (this.corsSettings.enabled) {
          this.addCorsHeaders(response);
        }

        return response;
      });

    } catch (error) {
      return this.handleError(error as Error, req);
    }
  };

  private async parseRequestBody(req: Request): Promise<any> {
    const contentType = req.headers.get('content-type');

    if (!contentType) {
      return undefined;
    }

    if (contentType.includes('application/json')) {
      try {
        return await req.json();
      } catch {
        throw new Error('Invalid JSON in request body');
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const result: any = {};
      for (const [key, value] of formData.entries()) {
        result[key] = value;
      }
      return result;
    }

    if (contentType.includes('text/')) {
      return await req.text();
    }

    return undefined;
  }

  private async createApiRequest(req: Request, body: any, log: any): Promise<BunApiServerRequest> {
    const url = new URL(req.url);
    const headers: { [key: string]: string } = {};

    // Convert Headers to plain object
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      body,
      params: {},
      query: Object.fromEntries(url.searchParams.entries()),
      headers,
      method: req.method,
      url: req.url,
      path: url.pathname,
      ip: headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
      log,
      get: (name: string) => headers[name.toLowerCase()],
      header: (name: string) => headers[name.toLowerCase()],
    };
  }

  private createApiResponse(): BunApiServerResponse {
    let responseData: {
      status: number;
      body: any;
      headers: Record<string, string>;
    } = {
      status: 200,
      body: '',
      headers: {},
    };

    const response: BunApiServerResponse = {
      status: (code: number) => {
        responseData.status = code;
        return response;
      },
      send: (body: any) => {
        responseData.body = body;
        return response;
      },
      json: (body: any) => {
        responseData.body = JSON.stringify(body);
        responseData.headers['content-type'] = 'application/json';
        return response;
      },
      set: (field: string, value: string) => {
        responseData.headers[field.toLowerCase()] = value;
        return response;
      },
      header: (field: string, value: string) => {
        responseData.headers[field.toLowerCase()] = value;
        return response;
      },
      get: (field: string) => responseData.headers[field.toLowerCase()],
      redirect: (statusOrUrl: number | string, url?: string) => {
        if (typeof statusOrUrl === 'string') {
          responseData.status = 302;
          responseData.headers['location'] = statusOrUrl;
        } else {
          responseData.status = statusOrUrl;
          responseData.headers['location'] = url!;
        }
        return response;
      },
      get statusCode() { return responseData.status; },
      set statusCode(code: number) { responseData.status = code; },
      headersSent: false,
      _getResponse: () => {
        const headers = new Headers(responseData.headers);
        return new Response(responseData.body, {
          status: responseData.status,
          headers,
        });
      },
    };

    return response;
  }

  private findRoute(method: string, path: string): Route | undefined {
    // First try exact match
    let route = this.routes.find(r => r.method === method && r.path === path);
    if (route) return route;

    // Then try pattern match
    return this.routes.find(r => {
      if (r.method !== method) return false;
      if (r.pathPattern) {
        return r.pathPattern.test(path);
      }
      return false;
    });
  }

  private handleCors(req: Request): Response {
    const headers = new Headers();

    if (this.corsSettings.enabled) {
      if (Array.isArray(this.corsSettings.origin)) {
        const origin = req.headers.get('origin');
        if (origin && this.corsSettings.origin.includes(origin)) {
          headers.set('Access-Control-Allow-Origin', origin);
        }
      } else {
        headers.set('Access-Control-Allow-Origin', this.corsSettings.origin);
      }

      if (this.corsSettings.methods) {
        const methods = Array.isArray(this.corsSettings.methods)
          ? this.corsSettings.methods.join(',')
          : this.corsSettings.methods;
        headers.set('Access-Control-Allow-Methods', methods);
      }

      if (this.corsSettings.allowedHeaders) {
        headers.set('Access-Control-Allow-Headers', this.corsSettings.allowedHeaders.join(','));
      }
    }

    return new Response(null, { status: 204, headers });
  }

  private addCorsHeaders(response: Response): void {
    if (!this.corsSettings.enabled) return;

    if (Array.isArray(this.corsSettings.origin)) {
      // For multiple origins, this would need to be handled in the request context
      const firstOrigin = this.corsSettings.origin[0];
      if (firstOrigin) {
        response.headers.set('Access-Control-Allow-Origin', firstOrigin);
      }
    } else {
      response.headers.set('Access-Control-Allow-Origin', this.corsSettings.origin);
    }

    if (this.corsSettings.methods) {
      const methods = Array.isArray(this.corsSettings.methods)
        ? this.corsSettings.methods.join(',')
        : this.corsSettings.methods;
      response.headers.set('Access-Control-Allow-Methods', methods);
    }
  }

  private async handleError(error: Error, req: Request): Promise<Response> {
    const log = this.loggerFactory.current("HTTP");
    log.error("Unhandled error", error, { path: new URL(req.url).pathname, method: req.method });

    if (this.errorHandler) {
      try {
        const body = await this.parseRequestBody(req);
        const apiReq = await this.createApiRequest(req, body, log);
        const apiRes = this.createApiResponse();

        const result = await this.errorHandler(error, apiReq, apiRes);
        return result instanceof Response ? result : apiRes._getResponse();
      } catch (handlerError) {
        log.error("Error handler failed", handlerError as Error);
      }
    }

    const isProd = process.env.NODE_ENV === "production";
    const errorResponse = {
      message: "An unhandled internal server error occurred",
      ...(isProd ? {} : { stack: error.stack, error: error.message })
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Route registration methods
  private addRoute(method: string, path: string, handler: BunRouteHandler) {
    this.logger.debug(`Adding route ${method} ${path}`);
    
    // Check if path has parameters (like :id)
    const paramPattern = /:([^/]+)/g;
    let match;
    const paramNames: string[] = [];
    let pathPattern: RegExp | undefined;

    // Extract parameter names
    while ((match = paramPattern.exec(path)) !== null) {
      const paramName = match[1];
      if (paramName) {
        paramNames.push(paramName);
      }
    }

    // Create regex pattern if there are parameters
    if (paramNames.length > 0) {
      const regexPath = path.replace(/:([^/]+)/g, '([^/]+)');
      pathPattern = new RegExp(`^${regexPath}$`);
    }

    this.routes.push({
      method,
      path,
      handler,
      pathPattern,
      paramNames: paramNames.length > 0 ? paramNames : undefined,
    });
  }

  /** Registers a GET route with the specified path and handler. */
  defineGetRoute = (path: string, handler: BunRouteHandler) => {
    this.addRoute('GET', path, handler);
  };

  /** Registers a POST route with the specified path and handler. */
  definePostRoute = (path: string, handler: BunRouteHandler) => {
    this.addRoute('POST', path, handler);
  };

  /** Registers a DELETE route with the specified path and handler. */
  defineDeleteRoute = (path: string, handler: BunRouteHandler) => {
    this.addRoute('DELETE', path, handler);
  };

  /** Registers a PUT route with the specified path and handler. */
  definePutRoute = (path: string, handler: BunRouteHandler) => {
    this.addRoute('PUT', path, handler);
  };

  /** Registers a PATCH route with the specified path and handler. */
  definePatchRoute = (path: string, handler: BunRouteHandler) => {
    this.addRoute('PATCH', path, handler);
  };
}