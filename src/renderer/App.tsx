// ABOUTME: Main React application component for Purple SQL Eater.
// ABOUTME: Manages SQL editor, query execution, and results display.

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import type { QueryResult } from '../shared/types';

function App() {
  const [sql, setSql] = useState('-- Write your SQL query here\nSELECT 1 as test');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setError(null);
    setIsExecuting(true);

    try {
      const result = await window.electron.executeQuery(sql);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResults(null);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="app">
      <div className="toolbar">
        <button onClick={handleExecute} disabled={isExecuting}>
          {isExecuting ? 'Executing...' : 'Execute Query'}
        </button>
        {results && (
          <span className="status">
            {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="editor-container">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(value) => setSql(value || '')}
          theme="vs"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 12 },
          }}
        />
      </div>

      <div className="results-container">
        {error && <div className="error">{error}</div>}

        {results && (
          <table className="results-table">
            <thead>
              <tr>
                {results.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
