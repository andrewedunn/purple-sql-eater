// ABOUTME: SQL formatting utility using sql-formatter library.
// ABOUTME: Configured for BigQuery dialect with sensible defaults.

import { format } from 'sql-formatter';

export interface FormatOptions {
  tabWidth?: number;
  useTabs?: boolean;
  keywordCase?: 'preserve' | 'upper' | 'lower';
  linesBetweenQueries?: number;
}

const DEFAULT_OPTIONS: FormatOptions = {
  tabWidth: 2,
  useTabs: false,
  keywordCase: 'upper',
  linesBetweenQueries: 2,
};

/**
 * Format SQL using BigQuery dialect.
 * Returns the formatted SQL or the original if formatting fails.
 */
export function formatSQL(sql: string, options: FormatOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    return format(sql, {
      language: 'bigquery',
      tabWidth: opts.tabWidth,
      useTabs: opts.useTabs,
      keywordCase: opts.keywordCase,
      linesBetweenQueries: opts.linesBetweenQueries,
    });
  } catch (error) {
    console.error('SQL formatting failed:', error);
    return sql;
  }
}
