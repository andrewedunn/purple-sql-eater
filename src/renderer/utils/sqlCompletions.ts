// ABOUTME: SQL completion provider for Monaco editor with schema awareness.
// ABOUTME: Generates completions for tables, columns, keywords, and BigQuery functions.

import type * as Monaco from 'monaco-editor';
import type { Table } from '../../shared/types';

type CompletionItem = Monaco.languages.CompletionItem;
type CompletionItemKind = Monaco.languages.CompletionItemKind;

// SQL keywords (common across dialects)
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON', 'JOIN', 'LEFT', 'RIGHT',
  'INNER', 'OUTER', 'FULL', 'CROSS', 'UNION', 'ALL', 'DISTINCT',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE',
  'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'ADD', 'COLUMN',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF',
  'EXISTS', 'ANY', 'SOME', 'WITH', 'RECURSIVE', 'PARTITION', 'OVER',
  'WINDOW', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING',
  'CURRENT', 'ROW', 'EXCEPT', 'INTERSECT',
];

// BigQuery-specific functions
const BIGQUERY_FUNCTIONS = [
  // Aggregate functions
  { name: 'COUNT', signature: 'COUNT(expression)', description: 'Returns the number of rows' },
  { name: 'SUM', signature: 'SUM(expression)', description: 'Returns the sum of values' },
  { name: 'AVG', signature: 'AVG(expression)', description: 'Returns the average of values' },
  { name: 'MIN', signature: 'MIN(expression)', description: 'Returns the minimum value' },
  { name: 'MAX', signature: 'MAX(expression)', description: 'Returns the maximum value' },
  { name: 'ARRAY_AGG', signature: 'ARRAY_AGG(expression)', description: 'Returns an array of values' },
  { name: 'STRING_AGG', signature: 'STRING_AGG(expression, delimiter)', description: 'Concatenates strings with delimiter' },
  { name: 'COUNTIF', signature: 'COUNTIF(expression)', description: 'Conditional count' },
  { name: 'APPROX_COUNT_DISTINCT', signature: 'APPROX_COUNT_DISTINCT(expression)', description: 'Approximate distinct count' },

  // String functions
  { name: 'CONCAT', signature: 'CONCAT(str1, str2, ...)', description: 'Concatenates strings' },
  { name: 'LENGTH', signature: 'LENGTH(string)', description: 'Returns string length' },
  { name: 'LOWER', signature: 'LOWER(string)', description: 'Converts to lowercase' },
  { name: 'UPPER', signature: 'UPPER(string)', description: 'Converts to uppercase' },
  { name: 'TRIM', signature: 'TRIM(string)', description: 'Removes leading/trailing whitespace' },
  { name: 'LTRIM', signature: 'LTRIM(string)', description: 'Removes leading whitespace' },
  { name: 'RTRIM', signature: 'RTRIM(string)', description: 'Removes trailing whitespace' },
  { name: 'SUBSTR', signature: 'SUBSTR(string, position, length)', description: 'Extracts substring' },
  { name: 'REPLACE', signature: 'REPLACE(string, from, to)', description: 'Replaces occurrences' },
  { name: 'REGEXP_EXTRACT', signature: 'REGEXP_EXTRACT(string, regexp)', description: 'Extracts regex match' },
  { name: 'REGEXP_CONTAINS', signature: 'REGEXP_CONTAINS(string, regexp)', description: 'Tests regex match' },
  { name: 'SPLIT', signature: 'SPLIT(string, delimiter)', description: 'Splits string into array' },
  { name: 'FORMAT', signature: 'FORMAT(format_string, ...)', description: 'Formats values as string' },

  // Date/time functions
  { name: 'DATE', signature: 'DATE(year, month, day)', description: 'Constructs a DATE' },
  { name: 'DATETIME', signature: 'DATETIME(date, time)', description: 'Constructs a DATETIME' },
  { name: 'TIMESTAMP', signature: 'TIMESTAMP(string)', description: 'Parses timestamp string' },
  { name: 'CURRENT_DATE', signature: 'CURRENT_DATE()', description: 'Returns current date' },
  { name: 'CURRENT_DATETIME', signature: 'CURRENT_DATETIME()', description: 'Returns current datetime' },
  { name: 'CURRENT_TIMESTAMP', signature: 'CURRENT_TIMESTAMP()', description: 'Returns current timestamp' },
  { name: 'DATE_ADD', signature: 'DATE_ADD(date, INTERVAL n UNIT)', description: 'Adds interval to date' },
  { name: 'DATE_SUB', signature: 'DATE_SUB(date, INTERVAL n UNIT)', description: 'Subtracts interval from date' },
  { name: 'DATE_DIFF', signature: 'DATE_DIFF(date1, date2, UNIT)', description: 'Returns difference between dates' },
  { name: 'DATE_TRUNC', signature: 'DATE_TRUNC(date, UNIT)', description: 'Truncates date to unit' },
  { name: 'EXTRACT', signature: 'EXTRACT(PART FROM date)', description: 'Extracts part from date' },
  { name: 'FORMAT_DATE', signature: 'FORMAT_DATE(format, date)', description: 'Formats date as string' },
  { name: 'PARSE_DATE', signature: 'PARSE_DATE(format, string)', description: 'Parses date from string' },

  // Math functions
  { name: 'ABS', signature: 'ABS(number)', description: 'Returns absolute value' },
  { name: 'ROUND', signature: 'ROUND(number, decimals)', description: 'Rounds to decimals' },
  { name: 'FLOOR', signature: 'FLOOR(number)', description: 'Rounds down' },
  { name: 'CEIL', signature: 'CEIL(number)', description: 'Rounds up' },
  { name: 'MOD', signature: 'MOD(a, b)', description: 'Returns remainder' },
  { name: 'POWER', signature: 'POWER(base, exponent)', description: 'Returns power' },
  { name: 'SQRT', signature: 'SQRT(number)', description: 'Returns square root' },
  { name: 'LOG', signature: 'LOG(number, base)', description: 'Returns logarithm' },
  { name: 'EXP', signature: 'EXP(number)', description: 'Returns e^number' },
  { name: 'SAFE_DIVIDE', signature: 'SAFE_DIVIDE(a, b)', description: 'Safe division (returns NULL on zero)' },

  // Conditional functions
  { name: 'IF', signature: 'IF(condition, true_value, false_value)', description: 'Conditional expression' },
  { name: 'IFNULL', signature: 'IFNULL(expression, null_value)', description: 'Returns value if not null' },
  { name: 'COALESCE', signature: 'COALESCE(val1, val2, ...)', description: 'Returns first non-null' },
  { name: 'NULLIF', signature: 'NULLIF(expr1, expr2)', description: 'Returns NULL if equal' },

  // Array functions
  { name: 'ARRAY_LENGTH', signature: 'ARRAY_LENGTH(array)', description: 'Returns array length' },
  { name: 'ARRAY_CONCAT', signature: 'ARRAY_CONCAT(arr1, arr2)', description: 'Concatenates arrays' },
  { name: 'ARRAY_REVERSE', signature: 'ARRAY_REVERSE(array)', description: 'Reverses array' },
  { name: 'UNNEST', signature: 'UNNEST(array)', description: 'Flattens array to rows' },

  // Window functions
  { name: 'ROW_NUMBER', signature: 'ROW_NUMBER() OVER(...)', description: 'Returns row number' },
  { name: 'RANK', signature: 'RANK() OVER(...)', description: 'Returns rank with gaps' },
  { name: 'DENSE_RANK', signature: 'DENSE_RANK() OVER(...)', description: 'Returns rank without gaps' },
  { name: 'LEAD', signature: 'LEAD(expr, offset) OVER(...)', description: 'Returns value from following row' },
  { name: 'LAG', signature: 'LAG(expr, offset) OVER(...)', description: 'Returns value from preceding row' },
  { name: 'FIRST_VALUE', signature: 'FIRST_VALUE(expr) OVER(...)', description: 'Returns first value in window' },
  { name: 'LAST_VALUE', signature: 'LAST_VALUE(expr) OVER(...)', description: 'Returns last value in window' },
  { name: 'NTH_VALUE', signature: 'NTH_VALUE(expr, n) OVER(...)', description: 'Returns nth value in window' },
];

/**
 * Create a completion item with the appropriate Monaco types
 */
function createCompletionItem(
  label: string,
  kind: CompletionItemKind,
  detail?: string,
  documentation?: string,
  insertText?: string,
  range?: Monaco.IRange
): CompletionItem {
  return {
    label,
    kind,
    detail,
    documentation,
    insertText: insertText || label,
    range: range as any, // Range will be provided by Monaco
  };
}

/**
 * Get completion items for SQL keywords
 */
export function getKeywordCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): CompletionItem[] {
  return SQL_KEYWORDS.map(keyword => {
    const item = createCompletionItem(
      keyword,
      monaco.languages.CompletionItemKind.Keyword,
      'SQL keyword',
      undefined,
      keyword,
      range
    );
    item.sortText = `2_${keyword.toLowerCase()}`;  // Sort after query columns (0) and functions (1)
    return item;
  });
}

/**
 * Get completion items for BigQuery functions
 */
export function getFunctionCompletions(
  monaco: typeof Monaco,
  range: Monaco.IRange
): CompletionItem[] {
  return BIGQUERY_FUNCTIONS.map(fn => {
    const item = createCompletionItem(
      fn.name,
      monaco.languages.CompletionItemKind.Function,
      fn.signature,
      fn.description,
      fn.name,
      range
    );
    item.sortText = `1_${fn.name.toLowerCase()}`;  // Sort after query columns (0), before keywords (2)
    return item;
  });
}

/**
 * Get completion items for tables from schema
 * If schemaFilter is provided, only show tables from that schema (and show just table name)
 */
export function getTableCompletions(
  monaco: typeof Monaco,
  tables: Table[],
  range: Monaco.IRange,
  recentTables: string[] = [],
  schemaFilter?: string
): CompletionItem[] {
  // Create a set of recent table names for quick lookup
  const recentSet = new Set(recentTables.map(t => t.toLowerCase()));

  // Filter tables by schema if specified
  const filteredTables = schemaFilter
    ? tables.filter(t => t.schema?.toLowerCase() === schemaFilter.toLowerCase())
    : tables;

  return filteredTables.map(table => {
    // If filtering by schema, just show table name (schema already typed)
    const displayName = schemaFilter ? table.name : (table.schema ? `${table.schema}.${table.name}` : table.name);
    const insertName = schemaFilter ? table.name : displayName;
    const isRecent = recentSet.has(displayName.toLowerCase());

    const item = createCompletionItem(
      displayName,
      monaco.languages.CompletionItemKind.Class,
      table.type || 'TABLE',
      table.columnCount ? `${table.columnCount} columns` : undefined,
      insertName,
      range
    );
    // Sort tables after columns/functions/keywords, but recent tables first within tables
    item.sortText = isRecent ? `3_0_${displayName.toLowerCase()}` : `3_1_${displayName.toLowerCase()}`;
    return item;
  }).sort((a, b) => {
    // Sort recent tables first
    const aRecent = recentSet.has((a.label as string).toLowerCase());
    const bRecent = recentSet.has((b.label as string).toLowerCase());
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return (a.label as string).localeCompare(b.label as string);
  });
}

/**
 * Get unique schema/dataset names from tables
 */
export function getSchemaNames(tables: Table[]): string[] {
  const schemas = new Set<string>();
  for (const table of tables) {
    if (table.schema) {
      schemas.add(table.schema);
    }
  }
  return Array.from(schemas);
}

/**
 * Check if an identifier is a schema name
 */
export function isSchemaName(tables: Table[], identifier: string): boolean {
  return tables.some(t => t.schema?.toLowerCase() === identifier.toLowerCase());
}

/**
 * Get completion items for columns from a specific table
 */
export function getColumnCompletions(
  monaco: typeof Monaco,
  tables: Table[],
  tableIdentifier: string,
  range: Monaco.IRange
): CompletionItem[] {
  // Find matching table (could be schema.table or just table name)
  const normalizedId = tableIdentifier.toLowerCase();
  console.log('getColumnCompletions: Looking for table:', normalizedId);

  const matchingTable = tables.find(t => {
    const fullName = t.schema ? `${t.schema}.${t.name}` : t.name;
    return fullName.toLowerCase() === normalizedId ||
           t.name.toLowerCase() === normalizedId;
  });

  console.log('getColumnCompletions: Found table:', matchingTable?.name, 'columns:', matchingTable?.columns?.length);

  if (!matchingTable || !matchingTable.columns) {
    return [];
  }

  return matchingTable.columns.map(col =>
    createCompletionItem(
      col.name,
      monaco.languages.CompletionItemKind.Field,
      col.type,
      col.nullable ? 'Nullable' : 'Not null',
      col.name,
      range
    )
  );
}

/**
 * Extract table name/alias before a dot for column completion
 * e.g., "SELECT t." -> "t", "FROM schema.table t WHERE t." -> "t"
 */
export function extractTableBeforeDot(textBeforeCursor: string): string | null {
  // Match identifier immediately before the dot
  const match = textBeforeCursor.match(/([`"]?[\w]+[`"]?(?:\.[`"]?[\w]+[`"]?)?)\.$/);
  return match ? match[1].replace(/[`"]/g, '') : null;
}

/**
 * Check if cursor is in a SELECT clause (between SELECT and FROM)
 */
export function isInSelectClause(sql: string, cursorPosition: number): boolean {
  const textBeforeCursor = sql.substring(0, cursorPosition).toUpperCase();
  const lastSelect = textBeforeCursor.lastIndexOf('SELECT');
  const lastFrom = textBeforeCursor.lastIndexOf('FROM');

  // We're in SELECT clause if SELECT appears after the last FROM (or no FROM yet)
  return lastSelect > lastFrom;
}

/**
 * Determine completion context from text before cursor
 */
export function getCompletionContext(
  textBeforeCursor: string
): 'table' | 'column' | 'keyword' | 'none' {
  const trimmed = textBeforeCursor.trimEnd();

  // After dot - column context
  if (trimmed.endsWith('.')) {
    return 'column';
  }

  // Check if we're in a FROM/JOIN clause by looking for FROM/JOIN followed by
  // optional table names, but NOT followed by WHERE/ON/GROUP/ORDER/HAVING/SELECT
  // This handles: "FROM ", "FROM tab", "FROM schema.tab", "FROM t1, ", etc.
  const fromJoinPattern = /\b(FROM|JOIN)\s+[\w.`"]*$/i;
  if (fromJoinPattern.test(trimmed)) {
    return 'table';
  }

  // After comma in FROM/JOIN clause - table context
  if (/\b(FROM|JOIN)\s+[\w.`"]+(\s*,\s*[\w.`"]*)$/i.test(trimmed)) {
    return 'table';
  }

  // Just after FROM or JOIN keyword with space
  if (/\b(FROM|JOIN)\s+$/i.test(trimmed)) {
    return 'table';
  }

  // In SELECT, WHERE, GROUP BY, ORDER BY context - could be column or keyword
  if (/\b(SELECT|WHERE|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING)\s+$/i.test(trimmed)) {
    return 'keyword';
  }

  return 'none';
}

/**
 * Extract all table references from SQL text (FROM and JOIN clauses)
 * Returns array of table names (could be schema.table or just table)
 */
export function extractTablesFromQuery(sql: string): string[] {
  const tables: string[] = [];

  // Match FROM table [alias] patterns
  const fromPattern = /\bFROM\s+([`"]?[\w]+[`"]?(?:\.[`"]?[\w]+[`"]?)?)/gi;
  // Match JOIN table [alias] patterns
  const joinPattern = /\bJOIN\s+([`"]?[\w]+[`"]?(?:\.[`"]?[\w]+[`"]?)?)/gi;

  let match;
  while ((match = fromPattern.exec(sql)) !== null) {
    tables.push(match[1].replace(/[`"]/g, ''));
  }

  while ((match = joinPattern.exec(sql)) !== null) {
    tables.push(match[1].replace(/[`"]/g, ''));
  }

  return tables;
}

/**
 * Get column completions from multiple tables
 * Groups columns by table for visual clarity, with high sort priority
 */
export function getMultiTableColumnCompletions(
  monaco: typeof Monaco,
  schemaTables: Table[],
  tableNames: string[],
  range: Monaco.IRange,
  addComma: boolean = false
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  const suffix = addComma ? ',' : '';

  for (const tableName of tableNames) {
    const normalizedName = tableName.toLowerCase();

    // Find matching table
    const matchingTable = schemaTables.find(t => {
      const fullName = t.schema ? `${t.schema}.${t.name}` : t.name;
      return fullName.toLowerCase() === normalizedName ||
             t.name.toLowerCase() === normalizedName;
    });

    if (matchingTable?.columns) {
      const shortTableName = matchingTable.name;

      for (const col of matchingTable.columns) {
        const item = createCompletionItem(
          col.name,
          monaco.languages.CompletionItemKind.Field,
          `${shortTableName}.${col.name}`,  // Show which table it's from
          `${col.type}${col.nullable ? '' : ' NOT NULL'} — from ${shortTableName}`,
          col.name + suffix,
          range
        );
        // Use ! prefix to force query columns to sort first (! < all alphanumeric and space)
        // This ensures columns from tables in the query appear above random table matches
        item.sortText = `!${col.name.toLowerCase()}`;
        completions.push(item);
      }
    }
  }

  return completions;
}

/**
 * Build table alias map from SQL text
 * Returns map of alias -> full table name
 */
export function buildAliasMap(sql: string): Map<string, string> {
  const aliasMap = new Map<string, string>();

  // Match: table AS alias, table alias (without AS)
  const fromPattern = /\bFROM\s+([`"]?[\w]+[`"]?(?:\.[`"]?[\w]+[`"]?)?)\s+(?:AS\s+)?([`"]?[\w]+[`"]?)/gi;
  const joinPattern = /\bJOIN\s+([`"]?[\w]+[`"]?(?:\.[`"]?[\w]+[`"]?)?)\s+(?:AS\s+)?([`"]?[\w]+[`"]?)/gi;

  let match;
  while ((match = fromPattern.exec(sql)) !== null) {
    const table = match[1].replace(/[`"]/g, '');
    const alias = match[2].replace(/[`"]/g, '');
    if (alias.toUpperCase() !== 'WHERE' && alias.toUpperCase() !== 'ON') {
      aliasMap.set(alias.toLowerCase(), table);
    }
  }

  while ((match = joinPattern.exec(sql)) !== null) {
    const table = match[1].replace(/[`"]/g, '');
    const alias = match[2].replace(/[`"]/g, '');
    if (alias.toUpperCase() !== 'ON' && alias.toUpperCase() !== 'WHERE') {
      aliasMap.set(alias.toLowerCase(), table);
    }
  }

  return aliasMap;
}
