import { DataTypes, Includeable, Op, Sequelize as SequelizeOrm } from "sequelize";

/** Sequelize wrapper class to manage database connections */
export class Sequelize extends SequelizeOrm {
  /**
   * Creates a Sequelize instance with the provided parameters.
   * @param connectionString Database connection string.
   * @param poolMaxConnections Maximum number of connections in the pool (must be > 0).
   * @param poolMinConnections Minimum number of connections in the pool (must be >= 0 and <= poolMaxConnections).
   * @param poolMaxTimeForConnection Maximum time (ms) to try to get a connection from the pool (must be > 0).
   * @param poolMaxIdleConnectionTime Maximum time (ms) a connection can be idle before being released (must be >= 0).
   * @param sslRequire Whether to require SSL for the connection (default is true).
   */
  constructor(
    connectionString: string,
    poolMaxConnections: number,
    poolMinConnections: number,
    poolMaxTimeForConnection: number,
    poolMaxIdleConnectionTime: number,
    sslRequire: boolean = true
  ) {
    if (!connectionString) throw new Error("connectionString must be specified")
    if (poolMaxConnections <= 0) throw new Error("poolMaxConnections must be greater than 0")
    if (poolMinConnections < 0) throw new Error("poolMinConnections must be greater or equal to 0")
    if (poolMaxConnections < poolMinConnections) throw new Error("poolMaxConnections must be greater or equal to poolMinConnections")
    if (poolMaxTimeForConnection <= 0) throw new Error("poolMaxTimeForConnection must be greater than 0")
    if (poolMaxIdleConnectionTime < 0) throw new Error("poolMaxIdleConnectionTime must be greater or equal to 0")

    super(
      connectionString,
      {
        pool: {
          max: poolMaxConnections,
          min: poolMinConnections,
          acquire: poolMaxTimeForConnection,
          idle: poolMaxIdleConnectionTime
        },
        dialectOptions: {
          ssl: {
            require: sslRequire
          }
        }
      }
    );
  }
}

export { DataTypes, Op };
export type { Includeable };