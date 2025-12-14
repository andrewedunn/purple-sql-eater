// ABOUTME: Simple SQL parser that extracts table names from SQL queries.
// ABOUTME: Uses regex patterns to identify tables in FROM and JOIN clauses.

export function extractTableNames(sql: string): string[] {
  const tableNames: Set<string> = new Set();
  const normalized = sql.toLowerCase();

  // Match FROM clause: FROM schema.table or FROM table
  const fromPattern = /\bfrom\s+([`"]?[\w]+[`"]?\.)?([`"]?[\w]+[`"]?)/gi;
  let match;
  while ((match = fromPattern.exec(normalized)) !== null) {
    const schema = match[1]?.replace(/[`".\s]/g, '');
    const table = match[2]?.replace(/[`"\s]/g, '');
    if (schema && table) {
      tableNames.add(`${schema}.${table}`);
    } else if (table) {
      tableNames.add(table);
    }
  }

  // Match JOIN clause: JOIN schema.table or JOIN table
  const joinPattern = /\bjoin\s+([`"]?[\w]+[`"]?\.)?([`"]?[\w]+[`"]?)/gi;
  while ((match = joinPattern.exec(normalized)) !== null) {
    const schema = match[1]?.replace(/[`".\s]/g, '');
    const table = match[2]?.replace(/[`"\s]/g, '');
    if (schema && table) {
      tableNames.add(`${schema}.${table}`);
    } else if (table) {
      tableNames.add(table);
    }
  }

  return Array.from(tableNames);
}
