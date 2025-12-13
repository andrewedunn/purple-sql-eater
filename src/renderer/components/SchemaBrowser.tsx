// ABOUTME: Schema browser sidebar showing tables and columns from the connected database.
// ABOUTME: Includes search-as-you-type filtering and collapsible table view.

import { useState, useEffect } from 'react';
import type { Table } from '../../shared/types';
import './SchemaBrowser.css';

interface SchemaBrowserProps {
  isVisible: boolean;
  onToggle: () => void;
  isConnected: boolean;
}

export function SchemaBrowser({
  isVisible,
  onToggle,
  isConnected,
}: SchemaBrowserProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isConnected && isVisible) {
      loadSchema();
    }
  }, [isConnected, isVisible]);

  const loadSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const schema = await window.electron.getSchema();
      setTables(schema.tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const filteredTables = tables.filter((table) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${table.schema}.${table.name}`.toLowerCase();
    if (fullName.includes(query)) return true;
    return table.columns.some((col) =>
      col.name.toLowerCase().includes(query)
    );
  });

  if (!isVisible) {
    return (
      <button className="schema-toggle collapsed" onClick={onToggle} title="Show schema">
        ▶
      </button>
    );
  }

  return (
    <>
      <div className="schema-browser">
        <div className="schema-header">
          <h3>Schema</h3>
          <button className="schema-toggle-btn" onClick={onToggle} title="Hide schema">
            ◀
          </button>
        </div>

        {!isConnected ? (
          <div className="schema-empty">
            <p>Not connected to a database</p>
          </div>
        ) : loading ? (
          <div className="schema-loading">
            <p>Loading schema...</p>
          </div>
        ) : error ? (
          <div className="schema-error">
            <p>{error}</p>
            <button onClick={loadSchema}>Retry</button>
          </div>
        ) : (
          <>
            <div className="schema-search">
              <input
                type="text"
                placeholder="Search tables and columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="schema-tables">
              {filteredTables.length === 0 ? (
                <div className="schema-empty">
                  <p>No tables found</p>
                </div>
              ) : (
                filteredTables.map((table) => {
                  const fullName = `${table.schema}.${table.name}`;
                  const isExpanded = expandedTables.has(fullName);

                  return (
                    <div key={fullName} className="schema-table">
                      <div
                        className="schema-table-header"
                        onClick={() => toggleTable(fullName)}
                      >
                        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                        <span className="table-name">{table.name}</span>
                        <span className="table-schema">{table.schema}</span>
                      </div>

                      {isExpanded && (
                        <div className="schema-columns">
                          {table.columns.map((col) => (
                            <div key={col.name} className="schema-column">
                              <span className="column-name">{col.name}</span>
                              <span className="column-type">{col.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
