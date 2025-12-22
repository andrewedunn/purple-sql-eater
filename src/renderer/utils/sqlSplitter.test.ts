// ABOUTME: Tests for SQL query splitting and position detection.
// ABOUTME: Verifies correct handling of strings, comments, and multi-query files.

import { describe, it, expect } from 'vitest';
import { splitQueries, getQueryAtPosition, getQueryRange } from './sqlSplitter';

describe('splitQueries', () => {
  describe('basic splitting', () => {
    it('should split simple semicolon-separated queries', () => {
      const sql = 'SELECT 1; SELECT 2; SELECT 3';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(3);
      expect(queries[0].sql).toBe('SELECT 1');
      expect(queries[1].sql).toBe('SELECT 2');
      expect(queries[2].sql).toBe('SELECT 3');
    });

    it('should handle query without trailing semicolon', () => {
      const sql = 'SELECT * FROM users';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toBe('SELECT * FROM users');
    });

    it('should handle trailing semicolon', () => {
      const sql = 'SELECT * FROM users;';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toBe('SELECT * FROM users');
    });

    it('should handle empty queries between semicolons', () => {
      const sql = 'SELECT 1;; ; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe('SELECT 1');
      expect(queries[1].sql).toBe('SELECT 2');
    });

    it('should handle whitespace-only input', () => {
      const sql = '   \n\t  ';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const sql = '';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(0);
    });

    it('should trim whitespace from queries', () => {
      const sql = '  SELECT 1  ;   SELECT 2   ';
      const queries = splitQueries(sql);

      expect(queries[0].sql).toBe('SELECT 1');
      expect(queries[1].sql).toBe('SELECT 2');
    });
  });

  describe('single-quoted strings', () => {
    it('should preserve semicolons inside single-quoted strings', () => {
      const sql = "SELECT 'hello; world' FROM test; SELECT 2";
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe("SELECT 'hello; world' FROM test");
      expect(queries[1].sql).toBe('SELECT 2');
    });

    it('should handle escaped single quotes', () => {
      const sql = "SELECT 'it''s a test;' FROM t; SELECT 2";
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe("SELECT 'it''s a test;' FROM t");
    });

    it('should handle multiple strings in one query', () => {
      const sql = "SELECT 'a;b', 'c;d' FROM t; SELECT 1";
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe("SELECT 'a;b', 'c;d' FROM t");
    });

    it('should handle newlines inside strings', () => {
      const sql = "SELECT 'line1\nline2' FROM t; SELECT 1";
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toContain('\n');
    });
  });

  describe('double-quoted identifiers', () => {
    it('should preserve semicolons inside double-quoted identifiers', () => {
      const sql = 'SELECT "column;name" FROM test; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe('SELECT "column;name" FROM test');
    });

    it('should handle escaped double quotes', () => {
      const sql = 'SELECT "col""name;x" FROM t; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe('SELECT "col""name;x" FROM t');
    });
  });

  describe('backtick-quoted identifiers', () => {
    it('should preserve semicolons inside backtick-quoted identifiers', () => {
      const sql = 'SELECT `column;name` FROM test; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe('SELECT `column;name` FROM test');
    });

    it('should handle BigQuery project.dataset.table notation', () => {
      const sql = 'SELECT * FROM `project.dataset.table`; SELECT 1';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toBe('SELECT * FROM `project.dataset.table`');
    });
  });

  describe('single-line comments', () => {
    it('should ignore semicolons inside single-line comments', () => {
      const sql = 'SELECT 1 -- comment; not a separator\n; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toContain('-- comment');
    });

    it('should handle comment at end of query', () => {
      const sql = 'SELECT 1 -- comment\n; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
    });

    it('should handle comment-only lines', () => {
      const sql = '-- just a comment\nSELECT 1';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toContain('-- just a comment');
    });
  });

  describe('multi-line comments', () => {
    it('should ignore semicolons inside multi-line comments', () => {
      const sql = 'SELECT 1 /* comment; still comment */; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toContain('/* comment');
    });

    it('should handle multi-line spanning comments', () => {
      const sql = 'SELECT 1 /* line1\n; line2\n; line3 */; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
    });

    it('should handle nested-looking comments (not actually nested)', () => {
      const sql = 'SELECT 1 /* outer /* inner */ rest */; SELECT 2';
      const queries = splitQueries(sql);

      // SQL doesn't support nested comments, so */ ends at first occurrence
      expect(queries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('line number tracking', () => {
    it('should track line numbers correctly for single line', () => {
      const sql = 'SELECT 1';
      const queries = splitQueries(sql);

      expect(queries[0].startLine).toBe(1);
      expect(queries[0].endLine).toBe(1);
    });

    it('should track line numbers correctly for multi-line query', () => {
      const sql = `SELECT
  *
FROM
  users`;
      const queries = splitQueries(sql);

      expect(queries[0].startLine).toBe(1);
      expect(queries[0].endLine).toBe(4);
    });

    it('should track line numbers correctly for multiple queries', () => {
      const sql = `SELECT 1;
SELECT
  2
FROM users;
SELECT 3`;
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(3);
      expect(queries[0].startLine).toBe(1);
      expect(queries[0].endLine).toBe(1);
      expect(queries[1].startLine).toBe(1); // starts after semicolon on line 1
      expect(queries[1].endLine).toBe(4);
      expect(queries[2].startLine).toBe(4); // starts after semicolon on line 4
      expect(queries[2].endLine).toBe(5);
    });
  });

  describe('offset tracking', () => {
    it('should track offsets correctly', () => {
      const sql = 'SELECT 1; SELECT 2';
      const queries = splitQueries(sql);

      expect(queries[0].startOffset).toBe(0);
      expect(queries[0].endOffset).toBe(8); // at semicolon
      expect(queries[1].startOffset).toBe(9); // immediately after semicolon
    });
  });

  describe('complex queries', () => {
    it('should handle CTEs', () => {
      const sql = `WITH cte AS (SELECT 1)
SELECT * FROM cte; SELECT 2`;
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
      expect(queries[0].sql).toContain('WITH cte');
    });

    it('should handle subqueries with semicolons in strings', () => {
      const sql = `SELECT * FROM (SELECT ';' as x) t; SELECT 2`;
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
    });

    it('should handle CASE statements', () => {
      const sql = `SELECT CASE WHEN x = 1 THEN 'a;b' ELSE 'c' END FROM t; SELECT 2`;
      const queries = splitQueries(sql);

      expect(queries).toHaveLength(2);
    });
  });
});

describe('getQueryAtPosition', () => {
  it('should find query containing cursor', () => {
    const sql = 'SELECT 1; SELECT 2; SELECT 3';
    const query = getQueryAtPosition(sql, 1, 12);

    expect(query?.sql).toBe('SELECT 2');
  });

  it('should find first query when cursor is at start', () => {
    const sql = 'SELECT 1; SELECT 2';
    const query = getQueryAtPosition(sql, 1, 1);

    expect(query?.sql).toBe('SELECT 1');
  });

  it('should return last query when cursor is after all queries', () => {
    const sql = 'SELECT 1; SELECT 2;';
    const query = getQueryAtPosition(sql, 1, 20);

    expect(query?.sql).toBe('SELECT 2');
  });

  it('should handle multi-line queries', () => {
    const sql = `SELECT 1;
SELECT
  *
FROM users;`;
    const query = getQueryAtPosition(sql, 3, 1);

    expect(query?.sql).toContain('SELECT');
    expect(query?.sql).toContain('FROM users');
  });

  it('should return query at cursor position in second query', () => {
    const sql = 'SELECT 1; SELECT 2';
    // 'SELECT 1; SELECT 2' - column 11 (1-indexed) = offset 10 = 'S' of second SELECT
    const query = getQueryAtPosition(sql, 1, 11);

    expect(query?.sql).toBe('SELECT 2');
  });

  it('should handle cursor at exact query boundary', () => {
    const sql = 'SELECT 1; SELECT 2';
    // Cursor at semicolon position (end of first query)
    const query = getQueryAtPosition(sql, 1, 9);

    expect(query).not.toBeNull();
  });

  it('should return null for empty SQL', () => {
    const sql = '';
    const query = getQueryAtPosition(sql, 1, 1);

    expect(query).toBeNull();
  });

  it('should return first query for whitespace-only before first query', () => {
    const sql = '   SELECT 1';
    const query = getQueryAtPosition(sql, 1, 1);

    expect(query?.sql).toBe('SELECT 1');
  });
});

describe('getQueryRange', () => {
  it('should return correct line and column ranges for single-line query', () => {
    const sql = 'SELECT 1; SELECT 2';
    const queries = splitQueries(sql);
    const range = getQueryRange(sql, queries[0]);

    expect(range.startLine).toBe(1);
    expect(range.endLine).toBe(1);
    expect(range.startColumn).toBe(1);
  });

  it('should return correct range for second query', () => {
    const sql = 'SELECT 1; SELECT 2';
    const queries = splitQueries(sql);
    const range = getQueryRange(sql, queries[1]);

    expect(range.startLine).toBe(1);
    expect(range.endLine).toBe(1);
    expect(range.startColumn).toBeGreaterThan(9);
  });

  it('should return correct range for multi-line query', () => {
    const sql = `SELECT
  *
FROM users`;
    const queries = splitQueries(sql);
    const range = getQueryRange(sql, queries[0]);

    expect(range.startLine).toBe(1);
    expect(range.endLine).toBe(3);
    expect(range.startColumn).toBe(1);
  });

  it('should handle query starting mid-line', () => {
    const sql = 'SELECT 1; SELECT 2';
    const queries = splitQueries(sql);
    const range = getQueryRange(sql, queries[1]);

    expect(range.startColumn).toBeGreaterThan(1);
  });

  it('should return minimum column of 1', () => {
    const sql = 'SELECT 1';
    const queries = splitQueries(sql);
    const range = getQueryRange(sql, queries[0]);

    expect(range.startColumn).toBeGreaterThanOrEqual(1);
    expect(range.endColumn).toBeGreaterThanOrEqual(1);
  });
});
