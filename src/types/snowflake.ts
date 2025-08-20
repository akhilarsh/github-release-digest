export interface ISnowflakeClient {
  connect(): Promise<void | unknown>;
  disconnect(): Promise<void>;
  executeQuery(sqlText: string): Promise<any[]>;
  executeQueryWithPolling?(sqlText: string, pollingInterval: number, maxPollingTime: number): Promise<any[]>;
}

export interface ISnowflakeConnectionConfig {
  account?: string;
  username?: string;
  password?: string;
  privateKey?: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
  authenticator?: string;
}


