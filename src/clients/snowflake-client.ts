import * as snowflake from 'snowflake-sdk';
import { logger } from '../utils/logger';
import { ISnowflakeClient, ISnowflakeConnectionConfig } from '../types';



class SnowflakeClient implements ISnowflakeClient {

  private connection: snowflake.Connection | undefined;

  private connectionOptions: snowflake.ConnectionOptions;

  public constructor(options: ISnowflakeConnectionConfig) {
    this.connectionOptions = {
      account: options.account,
      username: options.username,
      password: options.password,
      privateKey: options.privateKey,
      database: options.database,
      schema: options.schema,
      warehouse: options.warehouse,
      role: options.role,
      authenticator: options.authenticator,
    };
  }

  async connect(): Promise<snowflake.Connection> {
    this.connection = snowflake.createConnection(this.connectionOptions);
    return new Promise((resolve, reject) => {
      this.connection?.connect((err: snowflake.SnowflakeError | undefined, conn: snowflake.Connection) => {
        if (err) {
          logger.error({ err }, 'Unable to connect to Snowflake');
          reject(err);
        } else {
          logger.debug({}, 'Successfully connected to Snowflake');
          resolve(conn);
        }
      });
    });
  }

  async executeQuery(sqlText: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.connection?.execute({
        sqlText,
        complete(err: snowflake.SnowflakeError | undefined, stmt: snowflake.RowStatement, rows: any[] | undefined) {
          if (err) {
            logger.error(`Failed to execute statement due to the following error: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Successfully executed statement: ${stmt.getSqlText()}`);
            resolve(rows);
          }
        },
      });
    });
  }

  async executeQueryWithPolling(sqlText: string, pollingInterval: number, maxPollingTime: number): Promise<any[]> {
    const pollingStartTime = Date.now();
    const pollingEndTime = pollingStartTime + maxPollingTime;

    return new Promise((resolve, reject) => {
      const checkForData = async () => {
        const currentTime = Date.now();

        if (currentTime >= pollingEndTime) {
          logger.warn({}, 'Polling time exceeded. Returning no result rows.');
          resolve([]); // Resolve with an empty array when polling time exceeds and no data is found
          return;
        }

        this.connection.execute({
          sqlText,
          complete: (err, stmt, rows) => {
            if (err) {
              // Error code 002003 indicates "Object does not exist" in Snowflake
              // @ts-ignore
              if (err.code === '002003') {
                logger.warn({}, `Table does not exist yet. Polling again in ${pollingInterval} ms`);
                setTimeout(checkForData, pollingInterval);
              } else {
                logger.error({ err }, 'Snowflake query execution error');
                reject(err);
              }
            } else if (rows.length > 0) {
              logger.debug({ rows }, 'Query executed successfully');
              resolve(rows);
            } else {
              logger.warn({}, `No data found. Polling again in ${pollingInterval} ms`);
              setTimeout(checkForData, pollingInterval);
            }
          },
        });
      };

      checkForData();
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection?.destroy((err?: snowflake.SnowflakeError) => {
        if (err) {
          logger.error(`Unable to disconnect from Snowflake: ${err.message}`);
          reject(err);
        } else {
          logger.info('Disconnected from Snowflake');
          this.connection = null;
          resolve();
        }
      });
    });
  }

  buildReleasesSql(startDate: Date, endDate: Date, repositories?: string[], tableName: string = 'release'): string {
    const { database, schema } = this.connectionOptions;
    const fullTableName = database && schema ? `${database}.${schema}.${tableName}` : tableName;

    let whereClause = `WHERE action = 'released'
      AND release_published_at >= '${startDate.toISOString()}'
      AND release_published_at <= '${endDate.toISOString()}'`;

    if (repositories && repositories.length > 0) {
      const repoList = repositories.map(repo => `'${repo}'`).join(', ');
      whereClause += `
      AND repository_name IN (${repoList})`;
    }

    return `SELECT
      repository_name AS REPOSITORY,
      release_tag_name AS TAG_NAME,
      COALESCE(release_name, release_tag_name) AS RELEASE_NAME,
      release_published_at AS RELEASE_PUBLISHED_AT,
      release_body AS RELEASE_DESCRIPTION,
      release_html_url AS RELEASE_URL,
      release_author_login AS RELEASE_AUTHOR,
      release_prerelease AS RELEASE_IS_PRERELEASE
    FROM ${fullTableName}
    ${whereClause}
    ORDER BY release_published_at DESC`;
  }
}

export default SnowflakeClient;
