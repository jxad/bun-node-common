import type { ApiServerSettings } from "./api-server-settings"
import type { ApplicationSettings } from "./application-settings"
import type { BlockchainSettings } from "./blockchain-settings"
import type { DatabaseSettings } from "./database-settings"
import type { LogSettings } from "./log-settings"
import type { RabbitMqSettings } from "./rabbitmq-settings"

export interface SettingsBase {
  apiServer: ApiServerSettings
  application: ApplicationSettings
  blockchain: BlockchainSettings
  database: DatabaseSettings
  log: LogSettings
  rabbitmq: RabbitMqSettings
}