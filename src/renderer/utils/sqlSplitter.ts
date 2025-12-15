// ABOUTME: SQL parser that splits multi-query SQL into individual executable queries.
// ABOUTME: Handles semicolon delimiters while respecting strings and comments.

export interface ParsedQuery {
  sql: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Split SQL text into individual queries, respecting string literals and comments.
 * Returns array of ParsedQuery objects with position information.
 */
export function splitQueries(sql: string): ParsedQuery[] {
  const queries: ParsedQuery[] = [];
  let currentQuery = '';
  let currentStartLine = 1;
  let currentStartOffset = 0;
  let line = 1;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Track line numbers
    if (char === '\n') {
      line++;
    }

    // Skip single-line comments
    if (char === '-' && nextChar === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        currentQuery += sql[i];
        i++;
      }
      continue;
    }

    // Skip multi-line comments
    if (char === '/' && nextChar === '*') {
      currentQuery += char;
      i++;
      while (i < sql.length - 1) {
        currentQuery += sql[i];
        if (sql[i] === '\n') line++;
        if (sql[i] === '*' && sql[i + 1] === '/') {
          currentQuery += sql[i + 1];
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    // Skip single-quoted strings
    if (char === "'") {
      currentQuery += char;
      i++;
      while (i < sql.length) {
        currentQuery += sql[i];
        if (sql[i] === '\n') line++;
        if (sql[i] === "'" && sql[i + 1] === "'") {
          // Escaped quote
          currentQuery += sql[i + 1];
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Skip double-quoted identifiers
    if (char === '"') {
      currentQuery += char;
      i++;
      while (i < sql.length) {
        currentQuery += sql[i];
        if (sql[i] === '\n') line++;
        if (sql[i] === '"' && sql[i + 1] === '"') {
          // Escaped quote
          currentQuery += sql[i + 1];
          i += 2;
          continue;
        }
        if (sql[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Skip backtick-quoted identifiers (BigQuery, MySQL)
    if (char === '`') {
      currentQuery += char;
      i++;
      while (i < sql.length) {
        currentQuery += sql[i];
        if (sql[i] === '\n') line++;
        if (sql[i] === '`') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Query delimiter
    if (char === ';') {
      const trimmed = currentQuery.trim();
      if (trimmed) {
        queries.push({
          sql: trimmed,
          startLine: currentStartLine,
          endLine: line,
          startOffset: currentStartOffset,
          endOffset: i,
        });
      }
      currentQuery = '';
      currentStartLine = line;
      currentStartOffset = i + 1;
      i++;
      continue;
    }

    currentQuery += char;
    i++;
  }

  // Handle final query without trailing semicolon
  const trimmed = currentQuery.trim();
  if (trimmed) {
    queries.push({
      sql: trimmed,
      startLine: currentStartLine,
      endLine: line,
      startOffset: currentStartOffset,
      endOffset: sql.length,
    });
  }

  return queries;
}

/**
 * Find the query that contains the given cursor position.
 * Returns null if cursor is not within any query.
 */
export function getQueryAtPosition(
  sql: string,
  lineNumber: number,
  column: number
): ParsedQuery | null {
  const queries = splitQueries(sql);

  // Calculate absolute offset from line/column
  const lines = sql.split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  offset += column - 1;

  // Find query containing this offset
  for (const query of queries) {
    if (offset >= query.startOffset && offset <= query.endOffset) {
      return query;
    }
  }

  // If cursor is between queries or after last semicolon, find nearest
  // Check if we're in whitespace between queries
  for (let i = 0; i < queries.length - 1; i++) {
    const current = queries[i];
    const next = queries[i + 1];
    if (offset > current.endOffset && offset < next.startOffset) {
      // In between queries - return the previous one
      return current;
    }
  }

  // If after all queries, return the last one
  if (queries.length > 0 && offset > queries[queries.length - 1].endOffset) {
    return queries[queries.length - 1];
  }

  return queries.length > 0 ? queries[0] : null;
}

/**
 * Get line/column range for a query (useful for editor highlighting)
 */
export function getQueryRange(
  sql: string,
  query: ParsedQuery
): { startLine: number; startColumn: number; endLine: number; endColumn: number } {
  const lines = sql.split('\n');

  // Find start column
  let charCount = 0;
  let startColumn = 1;
  for (let i = 0; i < query.startLine - 1 && i < lines.length; i++) {
    charCount += lines[i].length + 1;
  }
  startColumn = query.startOffset - charCount + 1;

  // Find end column
  charCount = 0;
  let endColumn = 1;
  for (let i = 0; i < query.endLine - 1 && i < lines.length; i++) {
    charCount += lines[i].length + 1;
  }
  endColumn = query.endOffset - charCount + 1;

  return {
    startLine: query.startLine,
    startColumn: Math.max(1, startColumn),
    endLine: query.endLine,
    endColumn: Math.max(1, endColumn),
  };
}
