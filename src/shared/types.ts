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
