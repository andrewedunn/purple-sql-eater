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
 * Throws an error if formatting fails.
 */
export function formatSQL(sql: string, options: FormatOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return format(sql, {
    language: 'bigquery',
    tabWidth: opts.tabWidth,
    useTabs: opts.useTabs,
    keywordCase: opts.keywordCase,
    linesBetweenQueries: opts.linesBetweenQueries,
  });
}
