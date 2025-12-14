// ABOUTME: Shared type definitions for database connectors and query results.
// ABOUTME: These types are used by both main and renderer processes.

export interface ConnectionConfig {
  type: 'bigquery' | 'mysql' | 'postgresql' | 'snowflake';
  [key: string]: unknown;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export interface Schema {
  tables: Table[];
}

export interface Table {
  name: string;
  schema?: string;
  type?: 'TABLE' | 'VIEW' | 'EXTERNAL' | 'MATERIALIZED_VIEW';
  columns: Column[];
  columnCount?: number;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DatabaseConnector {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<QueryResult>;
  getSchema(): Promise<Schema>;
  getTables(): Promise<Table[]>;
  getColumns(tableName: string): Promise<Column[]>;
}
