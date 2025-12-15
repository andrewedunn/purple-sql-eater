// ABOUTME: Horizontal tab bar for switching between multiple query results.
// ABOUTME: Shows row counts, error status, and query snippets on hover.

import type { QueryExecution, QueryResult, QueryError } from '../../shared/types';
import './ResultsTabs.css';

interface ResultsTabsProps {
  execution: QueryExecution;
  activeResultIndex: number;
  onResultChange: (index: number) => void;
}

function isQueryError(result: QueryResult | QueryError): result is QueryError {
  return 'error' in result;
}

function getResultStatus(result: QueryResult | QueryError): 'success' | 'error' | 'empty' {
  if (isQueryError(result)) {
    return 'error';
  }
  return result.rowCount === 0 ? 'empty' : 'success';
}

function getResultLabel(result: QueryResult | QueryError, index: number): string {
  if (isQueryError(result)) {
    return `Result ${index + 1} (Error)`;
  }
  return `Result ${index + 1} (${result.rowCount.toLocaleString()})`;
}

function getQuerySnippet(sql: string): string {
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
}

export function ResultsTabs({ execution, activeResultIndex, onResultChange }: ResultsTabsProps) {
  // Don't show tabs if only one result
  if (execution.results.length <= 1) {
    return null;
  }

  return (
    <div className="results-tabs">
      <div className="results-tabs-list">
        {execution.results.map((result, index) => {
          const status = getResultStatus(result);
          const isActive = index === activeResultIndex;
          const query = execution.queries[index];
          const tooltip = query ? getQuerySnippet(query.sql) : '';

          return (
            <button
              key={index}
              className={`results-tab results-tab-${status} ${isActive ? 'active' : ''}`}
              onClick={() => onResultChange(index)}
              title={tooltip}
            >
              {getResultLabel(result, index)}
            </button>
          );
        })}
      </div>
      <div className="results-tabs-info">
        {execution.results.length} queries executed
      </div>
    </div>
  );
}
