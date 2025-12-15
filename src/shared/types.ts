// ABOUTME: Shared type definitions for database connectors and query results.
// ABOUTME: These types are used by both main and renderer processes.

// BigQuery service account credentials structure
export interface BigQueryServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Base connection config types for different databases
export interface BigQueryConnectionConfig {
  type: 'bigquery';
  projectId: string;
  keyFilename?: string;
  credentials?: BigQueryServiceAccountCredentials;
}

// Future database types (not yet implemented)
export interface MySQLConnectionConfig {
  type: 'mysql';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

export interface PostgreSQLConnectionConfig {
  type: 'postgresql';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

export interface SnowflakeConnectionConfig {
  type: 'snowflake';
  account: string;
  username: string;
  password: string;
  database?: string;
  warehouse?: string;
}

// Discriminated union of all connection types
export type ConnectionConfig =
  | BigQueryConnectionConfig
  | MySQLConnectionConfig
  | PostgreSQLConnectionConfig
  | SnowflakeConnectionConfig;

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

// Query execution types for multi-query support
export interface QueryError {
  error: string;
  query: string;
}

export interface QueryExecution {
  queries: { sql: string; startLine: number; endLine: number }[];
  results: (QueryResult | QueryError)[];
  executedAt: Date;
}

export type ExecutionMode = 'selection' | 'current' | 'all';

// Column filter types for results table filtering
export type FilterOperator = 'contains' | 'equals' | 'starts' | 'gt' | 'lt' | 'range' | 'is_null' | 'not_null';

export interface ColumnFilter {
  columnIndex: number;
  columnName: string;
  type: 'text' | 'number';
  operator: FilterOperator;
  value: string | number;
  value2?: number; // for range operator
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

// File system types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: number;
  modified?: Date;
  created?: Date;
  children?: FileNode[];
}

export interface FileTree {
  root: string;
  nodes: FileNode[];
  totalFiles: number;
  totalFolders: number;
}

export interface FileSearchResult {
  path: string;
  name: string;
  matches: FileMatch[];
  score: number;
}

export interface FileMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface FileChangeEvent {
  type: 'change' | 'unlink' | 'add';
  path: string;
  stats?: FileStats;
}

export interface FileStats {
  size: number;
  modified: Date;
  created: Date;
  isReadOnly: boolean;
}

export interface FilePermissions {
  canRead: boolean;
  canWrite: boolean;
  canExecute: boolean;
}

export interface SearchOptions {
  mode: 'filename' | 'content';
  includeHidden?: boolean;
  filePattern?: string;
  maxResults?: number;
}

export interface WorkspaceSettings {
  path: string;
  lastOpened: Date;
  recentFiles: string[];
  ignoredPatterns: string[];
  autoSave: boolean;
  autoSaveInterval: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface FileReadResult {
  content: string;
  stats: FileStats;
}

export interface FileWriteResult {
  success: boolean;
  bytesWritten: number;
}
