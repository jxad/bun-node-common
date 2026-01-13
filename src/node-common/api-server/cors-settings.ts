export interface CorsSettings {
  enabled: boolean;
  origin: string | string[];
  methods?: string | string[];
  allowedHeaders?: string[];
}

export const DEFAULT_CORS_SETTINGS: CorsSettings = {
  enabled: true,
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization"],
};