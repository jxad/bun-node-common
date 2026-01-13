import { Sequelize } from "sequelize";

export abstract class MigrationBase {
  abstract migrationName: string;
  abstract author: string;
  abstract date: Date;
  abstract description: string;
  abstract ticket: string;

  constructor(protected readonly sequelize: Sequelize) { }

  /** Runs the migration */
  async run() {
    await this.migration()
  }

  /** The implementation of the migration */
  abstract migrationImpl(): Promise<void>

  /** Base implementation of the migration */
  private async migration() {
    console.log(`Running migration ${this.migrationName} by ${this.author} on ${this.date.toISOString()}`)
    console.log(`Description: ${this.description}`)
    console.log(`Ticket: ${this.ticket}`)

    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "VersionHistory" (
        "id" SERIAL PRIMARY KEY,
        "migrationName" TEXT NOT NULL,
        "author" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "description" TEXT NOT NULL,
        "ticket" TEXT NOT NULL
      );
    `)

    //check if migration has already been run
    const res = await this.sequelize.query(`
      SELECT * FROM "VersionHistory" WHERE "migrationName" = '${this.migrationName}';
    `)
    if (res[0].length > 0) {
      console.log(`!!!CANNOT APPLY MIGRATION: ${this.migrationName}. BECAUSE IT HAS ALREADY BEEN APPLIED!!!`)
      return;
    }

    await this.migrationImpl()

    await this.sequelize.query(`
      INSERT INTO "VersionHistory" ("migrationName", "author", "date", "description", "ticket")
      VALUES ('${this.migrationName}', '${this.author}', '${this.date.toISOString()}', '${this.description}', '${this.ticket}');
    `)

    console.log(`Migration ${this.migrationName} completed`)
  }

}