export interface PostgreSettings {
  connectionString: string
  poolMaxConnections: number
  poolMinConnections: number
  poolMaxTimeForConnection: number
  poolMaxIdleConnectionTime: number
}

export interface DatabaseSettings {
  postgre: PostgreSettings
}