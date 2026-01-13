import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from "axios";
import { type ScopedLogger, LoggerFactory, TracingPropagator } from "../logger";

export interface ApiClientOptions {
  baseURL: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  loggerFactory: LoggerFactory; // required for consistent logging
  serviceName?: string; // service identifier
  retries?: number; // retry on 5xx/network errors
}

export class ApiClient {
  private readonly axios: AxiosInstance;
  private readonly log: ScopedLogger;
  private readonly retries: number;
  private readonly propagator: TracingPropagator;

  constructor(opts: ApiClientOptions) {
    this.axios = axios.create({ baseURL: opts.baseURL, timeout: opts.timeoutMs ?? 15000, headers: opts.headers });
    this.log = opts.loggerFactory.current(opts.serviceName ?? "ApiClient");
    this.retries = Math.max(0, opts.retries ?? 0);
    this.propagator = new TracingPropagator(opts.loggerFactory.getTraceContextStore());

    this.installInterceptors();
  }

  private installInterceptors(): void {
    this.axios.interceptors.request.use((config) => {
      const trace = this.propagator.buildOutboundHeaders();

      const anyCfg = config as any;
      if (!anyCfg.headers || typeof anyCfg.headers.set !== "function") {
        const { AxiosHeaders } = require("axios");
        anyCfg.headers = new AxiosHeaders(anyCfg.headers || {});
      }
      Object.entries(trace).forEach(([k, v]) => anyCfg.headers.set(k, v));

      (config as any).__start = Date.now();
      this.log.debug("HTTP → outbound request", { method: config.method, url: config.url });
      return config;
    });

    this.axios.interceptors.response.use(
      (resp) => {
        const start = (resp.config as any).__start as number | undefined;
        const durationMs = start ? Date.now() - start : undefined;
        this.log.info("HTTP ← response", { status: resp.status, url: resp.config.url, durationMs });
        return resp;
      },
      async (error) => {
        const cfg = error.config as AxiosRequestConfig & { __retryCount?: number; __start?: number };
        const start = (cfg as any)?.__start;
        const durationMs = start ? Date.now() - start : undefined;
        const status = error.response?.status;
        const code = error.code;
        const url = cfg?.url;
        this.log.warn("HTTP ← error", { status, code, url, durationMs });

        const retriable = !status || (status >= 500 && status < 600) || ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(code || "");
        cfg.__retryCount = cfg.__retryCount ?? 0;
        if (retriable && cfg.__retryCount < this.retries) {
          cfg.__retryCount++;
          this.log.info("Retrying outbound request", { attempt: cfg.__retryCount, url });
          return this.axios(cfg);
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> { return this.axios.get<T>(url, config); }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> { return this.axios.post<T>(url, data, config); }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> { return this.axios.put<T>(url, data, config); }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> { return this.axios.patch<T>(url, data, config); }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> { return this.axios.delete<T>(url, config); }
}

export {
  AxiosResponse,
  AxiosError
}