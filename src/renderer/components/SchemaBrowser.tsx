// ABOUTME: Schema browser sidebar showing tables and columns from the connected database.
// ABOUTME: Includes search-as-you-type filtering and collapsible table view.

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Table } from '../../shared/types';
import { LayoutMenu } from './LayoutMenu';
import './SchemaBrowser.css';

interface SchemaBrowserProps {
  isVisible: boolean;
  onToggle: () => void;
  isConnected: boolean;
  onInsertText?: (text: string) => void;
  recentTables?: string[];
  connectionId?: string;
  position?: 'left' | 'right';
  onPositionChange?: (position: 'left' | 'right') => void;
  showLayoutMode?: boolean;
  layoutMode?: 'stacked' | 'horizontal';
  onLayoutModeChange?: (mode: 'stacked' | 'horizontal') => void;
  onSchemaLoaded?: (tables: Table[]) => void;
}

export function SchemaBrowser({
  isVisible,
  onToggle,
  isConnected,
  onInsertText,
  recentTables = [],
  connectionId,
  position = 'left',
  onPositionChange,
  showLayoutMode = false,
  layoutMode = 'stacked',
  onLayoutModeChange,
  onSchemaLoaded,
}: SchemaBrowserProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const tablesRef = useRef<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [preSearchExpandedSchemas, setPreSearchExpandedSchemas] = useState<Set<string>>(new Set());
  const [preSearchExpandedTables, setPreSearchExpandedTables] = useState<Set<string>>(new Set());
  const [searchScope, setSearchScope] = useState<'all' | 'tables'>('all');
  const [displayMode, setDisplayMode] = useState<'filter' | 'highlight'>('filter');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [savedScrollTop, setSavedScrollTop] = useState(0);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const browserRef = useRef<HTMLDivElement>(null);
  const [loadedColumns, setLoadedColumns] = useState<Set<string>>(new Set());
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [columnLoadingProgress, setColumnLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const columnLoadingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isConnected && tables.length === 0 && !loading && !error) {
      loadSchema();
    }
  }, [isConnected]);

  const loadSchema = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setLoadedColumns(new Set());
    setLoadingColumns(new Set());

    // Try to load from cache first (unless force refresh)
    const cacheKey = `schema-cache-${connectionId || 'default'}`;
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedSchema = JSON.parse(cached);
          console.log(`Loaded ${cachedSchema.tables.length} tables from cache`);
          setTables(cachedSchema.tables);
          tablesRef.current = cachedSchema.tables;
          setLoading(false);

          // Refresh in background
          refreshSchemaInBackground(cacheKey);
          return;
        } catch (err) {
          console.error('Failed to parse cached schema:', err);
        }
      }
    }

    // No cache or force refresh - load fresh
    setTables([]);
    setLoadingProgress(null);

    // Listen for progress updates
    const progressHandler = (_event: any, progress: { current: number; total: number }) => {
      setLoadingProgress(progress);
    };
    window.electron.ipcRenderer?.on('schema-progress', progressHandler);

    console.time('Schema load (total)');
    try {
      const schema = await window.electron.getSchema();
      console.timeEnd('Schema load (total)');
      console.log(`Loaded ${schema.tables.length} tables`);
      setTables(schema.tables);
      tablesRef.current = schema.tables;

      // Cache for next time
      localStorage.setItem(cacheKey, JSON.stringify(schema));
      setLoadingProgress(null);

      // Start loading columns in background
      loadAllColumnsInBackground(schema.tables);
    } catch (err) {
      console.timeEnd('Schema load (total)');
      setError(err instanceof Error ? err.message : 'Failed to load schema');
      setLoadingProgress(null);
    } finally {
      setLoading(false);
      window.electron.ipcRenderer?.removeListener('schema-progress', progressHandler);
    }
  };

  const refreshSchemaInBackground = async (cacheKey: string) => {
    try {
      console.log('Refreshing schema in background...');
      const schema = await window.electron.getSchema();
      console.log(`Background refresh complete: ${schema.tables.length} tables`);

      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify(schema));

      // Update UI if tables changed
      setTables(schema.tables);
      tablesRef.current = schema.tables;

      // Start loading columns in background
      loadAllColumnsInBackground(schema.tables);
    } catch (err) {
      console.error('Background schema refresh failed:', err);
    }
  };

  const loadAllColumnsInBackground = async (tablesToLoad: Table[]) => {
    // Cancel any existing column loading
    if (columnLoadingAbortRef.current) {
      columnLoadingAbortRef.current.abort();
    }

    const abortController = new AbortController();
    columnLoadingAbortRef.current = abortController;

    const total = tablesToLoad.length;
    let loaded = 0;

    console.log(`Starting background column loading for ${total} tables`);
    setColumnLoadingProgress({ loaded: 0, total });

    // Load in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    for (let i = 0; i < tablesToLoad.length; i += BATCH_SIZE) {
      if (abortController.signal.aborted) {
        console.log('Column loading aborted');
        setColumnLoadingProgress(null);
        return;
      }

      const batch = tablesToLoad.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (table) => {
          const fullName = `${table.schema}.${table.name}`;

          try {
            const columns = await window.electron.getColumns(fullName);

            if (abortController.signal.aborted) return;

            setTables(prevTables => {
              const newTables = prevTables.map(t => {
                const tFullName = `${t.schema}.${t.name}`;
                if (tFullName === fullName) {
                  return { ...t, columns };
                }
                return t;
              });
              tablesRef.current = newTables;
              return newTables;
            });

            setLoadedColumns(prev => new Set(prev).add(fullName));
            loaded++;
            setColumnLoadingProgress({ loaded, total });
          } catch (err) {
            console.error(`Failed to load columns for ${fullName}:`, err);
            loaded++;
            setColumnLoadingProgress({ loaded, total });
          }
        })
      );
    }

    console.log(`Finished loading columns for ${loaded}/${total} tables`);
    setColumnLoadingProgress(null);

    // Notify parent that schema with columns is ready
    if (onSchemaLoaded) {
      console.log('SchemaBrowser: Calling onSchemaLoaded with', tablesRef.current.length, 'tables');
      onSchemaLoaded(tablesRef.current);
    }
  };

  const toggleSchema = (schemaName: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
    }
    setExpandedSchemas(newExpanded);
  };

  const toggleTable = async (fullTableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(fullTableName)) {
      newExpanded.delete(fullTableName);
      setExpandedTables(newExpanded);
    } else {
      newExpanded.add(fullTableName);
      setExpandedTables(newExpanded);

      if (!loadedColumns.has(fullTableName)) {
        setLoadingColumns(new Set(loadingColumns).add(fullTableName));
        try {
          const columns = await window.electron.getColumns(fullTableName);

          setTables(prevTables => {
            const newTables = prevTables.map(table => {
              const tableFullName = `${table.schema}.${table.name}`;
              if (tableFullName === fullTableName) {
                return { ...table, columns };
              }
              return table;
            });
            tablesRef.current = newTables;
            return newTables;
          });

          setLoadedColumns(new Set(loadedColumns).add(fullTableName));
        } catch (err) {
          console.error(`Failed to load columns for ${fullTableName}:`, err);
        } finally {
          const newLoading = new Set(loadingColumns);
          newLoading.delete(fullTableName);
          setLoadingColumns(newLoading);
        }
      }
    }
  };

  const collapseAll = () => {
    setExpandedSchemas(new Set());
    setExpandedTables(new Set());
  };

  const expandAll = () => {
    const allSchemas = new Set(Object.keys(groupedBySchema));
    setExpandedSchemas(allSchemas);
    // Don't auto-expand all tables - that could be thousands of items
    setExpandedTables(new Set());
  };

  const groupedBySchema = useMemo(() => {
    return tables.reduce((acc, table) => {
      const schema = table.schema || 'default';
      if (!acc[schema]) {
        acc[schema] = [];
      }
      acc[schema].push(table);
      return acc;
    }, {} as Record<string, Table[]>);
  }, [tables]);

  const filteredGroupedBySchema = useMemo(() => {
    if (!searchQuery || displayMode !== 'filter') return groupedBySchema;

    return Object.entries(groupedBySchema).reduce((acc, [schemaName, schemaTables]) => {
      const query = searchQuery.toLowerCase();
      const schemaNameMatches = schemaName.toLowerCase().includes(query);

      const filtered = schemaTables
        .map((table) => {
          const fullName = `${table.schema}.${table.name}`.toLowerCase();
          const tableNameMatches = fullName.includes(query);

          // Filter columns to only show matches (if searching all)
          const matchingColumns = searchScope === 'all'
            ? table.columns.filter((col) => col.name.toLowerCase().includes(query))
            : [];

          // Include table if schema/name matches OR it has matching columns
          if (schemaNameMatches || tableNameMatches || matchingColumns.length > 0) {
            return {
              ...table,
              // Show all columns if table/schema name matches, otherwise only matching columns
              columns: (schemaNameMatches || tableNameMatches) ? table.columns : matchingColumns,
            };
          }
          return null;
        })
        .filter((table): table is Table => table !== null);

      if (filtered.length > 0) {
        acc[schemaName] = filtered;
      }
      return acc;
    }, {} as Record<string, Table[]>);
  }, [groupedBySchema, searchQuery, displayMode, searchScope]);

  const handleSearchChange = (value: string) => {
    // Save state when search first starts
    if (value && !searchQuery) {
      setPreSearchExpandedSchemas(new Set(expandedSchemas));
      setPreSearchExpandedTables(new Set(expandedTables));
      if (scrollRef.current) {
        setSavedScrollTop(scrollRef.current.scrollTop);
      }
    }
    setSearchQuery(value);
  };

  // Auto-expand matching items during filter mode search
  useEffect(() => {
    if (searchQuery && displayMode === 'filter') {
      const newExpandedSchemas = new Set<string>();
      const newExpandedTables = new Set<string>();

      Object.entries(filteredGroupedBySchema).forEach(([schemaName, schemaTables]) => {
        newExpandedSchemas.add(schemaName);

        schemaTables.forEach((table) => {
          const fullName = `${table.schema}.${table.name}`;
          newExpandedTables.add(fullName);
        });
      });

      setExpandedSchemas(newExpandedSchemas);
      setExpandedTables(newExpandedTables);
    }
  }, [searchQuery, displayMode]);

  const handleClearSearch = () => {
    setSearchQuery('');
    // Restore pre-search expansion state
    setExpandedSchemas(preSearchExpandedSchemas);
    setExpandedTables(preSearchExpandedTables);
    // Clear the saved state
    setPreSearchExpandedSchemas(new Set());
    setPreSearchExpandedTables(new Set());
    // Restore scroll position
    if (scrollRef.current) {
      scrollRef.current.scrollTop = savedScrollTop;
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query || displayMode !== 'highlight') return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <mark className="search-highlight">{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </>
    );
  };

  const schemaHasMatches = (schemaName: string, schemaTables: Table[]): boolean => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();

    if (schemaName.toLowerCase().includes(query)) return true;

    return schemaTables.some((table) => {
      const fullName = `${table.schema}.${table.name}`.toLowerCase();
      if (fullName.includes(query)) return true;

      if (searchScope === 'all') {
        return table.columns.some((col) => col.name.toLowerCase().includes(query));
      }
      return false;
    });
  };

  const tableHasMatches = (table: Table): boolean => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();

    const fullName = `${table.schema}.${table.name}`.toLowerCase();
    if (fullName.includes(query)) return true;

    if (searchScope === 'all') {
      return table.columns.some((col) => col.name.toLowerCase().includes(query));
    }
    return false;
  };

  const getTableIcon = (tableType?: string) => {
    switch (tableType) {
      case 'VIEW':
        return 'V';
      case 'MATERIALIZED_VIEW':
        return 'M';
      case 'EXTERNAL':
        return 'E';
      default:
        return 'T';
    }
  };

  const handleInsertSchema = (schemaName: string) => {
    if (onInsertText) {
      onInsertText(schemaName);
    }
  };

  const handleInsertTable = (table: Table) => {
    if (onInsertText) {
      const fullName = table.schema ? `${table.schema}.${table.name}` : table.name;
      onInsertText(fullName);
    }
  };

  const handleInsertColumn = (table: Table, columnName: string) => {
    if (onInsertText) {
      const fullName = table.schema ? `${table.schema}.${table.name}` : table.name;
      onInsertText(`${fullName}.${columnName}`);
    }
  };

  const handleJumpToTable = (table: Table) => {
    const schemaName = table.schema || 'default';
    const fullName = `${table.schema}.${table.name}`;

    // Expand the schema if not already expanded
    if (!expandedSchemas.has(schemaName)) {
      setExpandedSchemas(new Set(expandedSchemas).add(schemaName));
    }

    // Scroll to the table after a short delay to allow expansion
    setTimeout(() => {
      const element = scrollRef.current?.querySelector(`[data-item-id="table:${fullName}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Briefly highlight the table
        setFocusedItem(`table:${fullName}`);
        setTimeout(() => setFocusedItem(null), 2000);
      }
    }, 100);
  };

  // Build flat list of visible items for keyboard navigation
  const getVisibleItems = (): Array<{ type: 'schema' | 'table' | 'column'; id: string; schemaName?: string; table?: Table; columnName?: string }> => {
    const items: Array<{ type: 'schema' | 'table' | 'column'; id: string; schemaName?: string; table?: Table; columnName?: string }> = [];

    Object.entries(filteredGroupedBySchema).forEach(([schemaName, schemaTables]) => {
      items.push({ type: 'schema', id: `schema:${schemaName}`, schemaName });

      if (expandedSchemas.has(schemaName)) {
        schemaTables.forEach((table) => {
          const fullName = `${table.schema}.${table.name}`;
          items.push({ type: 'table', id: `table:${fullName}`, table });

          if (expandedTables.has(fullName)) {
            table.columns.forEach((col) => {
              items.push({ type: 'column', id: `column:${fullName}.${col.name}`, table, columnName: col.name });
            });
          }
        });
      }
    });

    return items;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible || !browserRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getVisibleItems();
      if (items.length === 0) return;

      const currentIndex = focusedItem ? items.findIndex(item => item.id === focusedItem) : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            setFocusedItem(items[currentIndex + 1].id);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setFocusedItem(items[currentIndex - 1].id);
          } else if (currentIndex === -1 && items.length > 0) {
            setFocusedItem(items[0].id);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex !== -1) {
            const item = items[currentIndex];
            if (item.type === 'schema') {
              if (!expandedSchemas.has(item.schemaName!)) {
                toggleSchema(item.schemaName!);
              }
            } else if (item.type === 'table') {
              const fullName = `${item.table!.schema}.${item.table!.name}`;
              if (!expandedTables.has(fullName)) {
                toggleTable(fullName);
              }
            }
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex !== -1) {
            const item = items[currentIndex];
            if (item.type === 'column') {
              const fullName = `${item.table!.schema}.${item.table!.name}`;
              if (expandedTables.has(fullName)) {
                toggleTable(fullName);
                setFocusedItem(`table:${fullName}`);
              }
            } else if (item.type === 'table') {
              const fullName = `${item.table!.schema}.${item.table!.name}`;
              if (expandedTables.has(fullName)) {
                toggleTable(fullName);
              } else {
                setFocusedItem(`schema:${item.table!.schema}`);
              }
            } else if (item.type === 'schema') {
              if (expandedSchemas.has(item.schemaName!)) {
                toggleSchema(item.schemaName!);
              }
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (currentIndex !== -1) {
            const item = items[currentIndex];
            if (item.type === 'schema') {
              handleInsertSchema(item.schemaName!);
            } else if (item.type === 'table') {
              handleInsertTable(item.table!);
            } else if (item.type === 'column') {
              handleInsertColumn(item.table!, item.columnName!);
            }
          }
          break;
      }
    };

    browserRef.current.addEventListener('keydown', handleKeyDown);
    const ref = browserRef.current;

    return () => {
      ref?.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, focusedItem, filteredGroupedBySchema, expandedSchemas, expandedTables]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedItem && scrollRef.current) {
      const element = scrollRef.current.querySelector(`[data-item-id="${focusedItem}"]`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedItem]);

  if (!isVisible) {
    return (
      <button
        className={`schema-toggle collapsed ${position === 'right' ? 'right' : ''}`}
        onClick={onToggle}
        title="Show schema"
      >
        {position === 'right' ? '◀' : '▶'}
      </button>
    );
  }

  return (
    <>
      <div className="schema-browser" ref={browserRef} tabIndex={0}>
        <div className="schema-header">
          <h3>Schema</h3>
          <div className="schema-header-actions">
            <button
              className="schema-action-btn"
              onClick={(e) => loadSchema(e.shiftKey)}
              title="Refresh schema (Shift+click to bypass cache)"
              disabled={loading}
            >
              ↻
            </button>
            <button className="schema-action-btn" onClick={collapseAll} title="Collapse all">
              ◧
            </button>
            <button className="schema-action-btn" onClick={expandAll} title="Expand all schemas">
              ◨
            </button>
            {onPositionChange && (
              <LayoutMenu
                currentPosition={position}
                onPositionChange={onPositionChange}
                showLayoutMode={showLayoutMode}
                currentLayoutMode={layoutMode}
                onLayoutModeChange={onLayoutModeChange}
              />
            )}
            <button className="schema-toggle-btn" onClick={onToggle} title="Hide schema">
              {position === 'right' ? '▶' : '◀'}
            </button>
          </div>
        </div>

        {!isConnected ? (
          <div className="schema-empty">
            <p>Not connected to a database</p>
          </div>
        ) : loading ? (
          <div className="schema-loading">
            <p>Loading schema...</p>
            {loadingProgress && (
              <p className="loading-progress">
                {loadingProgress.current} of {loadingProgress.total} datasets
              </p>
            )}
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
                placeholder={searchScope === 'all' ? 'Search tables and columns...' : 'Search tables and schemas...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <div className="search-controls">
                <button
                  className={`search-mode-btn ${searchScope === 'all' ? 'active' : ''}`}
                  onClick={() => setSearchScope(searchScope === 'all' ? 'tables' : 'all')}
                  title={searchScope === 'all' ? 'Search all (tables, schemas, columns)' : 'Search tables and schemas only'}
                >
                  {searchScope === 'all' ? '◎' : '○'}
                </button>
                <button
                  className={`search-mode-btn ${displayMode === 'filter' ? 'active' : ''}`}
                  onClick={() => setDisplayMode(displayMode === 'filter' ? 'highlight' : 'filter')}
                  title={displayMode === 'filter' ? 'Filter mode (hide non-matches)' : 'Highlight mode (show all, highlight matches)'}
                >
                  {displayMode === 'filter' ? '⊙' : '⊕'}
                </button>
                {searchQuery && (
                  <button
                    className="search-clear"
                    onClick={handleClearSearch}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {columnLoadingProgress && (
              <div className="column-loading-progress">
                Loading columns: {columnLoadingProgress.loaded} / {columnLoadingProgress.total}
              </div>
            )}

            <div className="schema-tree" ref={scrollRef}>
              {recentTables.length > 0 && !searchQuery && (
                <div className="schema-recent">
                  <div
                    className="schema-recent-header"
                    onClick={() => setRecentExpanded(!recentExpanded)}
                  >
                    <span className="expand-icon">{recentExpanded ? '▼' : '▶'}</span>
                    <span className="recent-label">Recent</span>
                  </div>
                  {recentExpanded && (
                    <div className="recent-tables">
                      {recentTables.map((tableName) => {
                        const matchingTable = tables.find(t => {
                          const fullName = `${t.schema}.${t.name}`;
                          return fullName === tableName || t.name === tableName;
                        });

                        if (!matchingTable) return null;

                        const fullName = `${matchingTable.schema}.${matchingTable.name}`;
                        const tableIcon = getTableIcon(matchingTable.type);
                        const typeTitle = matchingTable.type || 'TABLE';

                        return (
                          <div
                            key={tableName}
                            className="recent-table"
                            onClick={() => handleJumpToTable(matchingTable)}
                            onDoubleClick={() => handleInsertTable(matchingTable)}
                            title={`${fullName}${matchingTable.type ? ` (${typeTitle})` : ''} - Click to jump, double-click to insert`}
                          >
                            <span className="table-type-icon" title={typeTitle}>{tableIcon}</span>
                            <span className="recent-table-name">{matchingTable.name}</span>
                            <span className="table-schema">{matchingTable.schema}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {Object.keys(filteredGroupedBySchema).length === 0 ? (
                <div className="schema-empty">
                  <p>No tables found</p>
                </div>
              ) : (
                Object.entries(filteredGroupedBySchema)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([schemaName, schemaTables]) => {
                  const isSchemaExpanded = expandedSchemas.has(schemaName);
                  const hasMatches = displayMode === 'highlight' && !isSchemaExpanded && schemaHasMatches(schemaName, schemaTables);

                  const schemaItemId = `schema:${schemaName}`;
                  return (
                    <div key={schemaName} className="schema-group">
                      <div
                        className={`schema-group-header ${focusedItem === schemaItemId ? 'focused' : ''}`}
                        onClick={() => toggleSchema(schemaName)}
                        onDoubleClick={() => handleInsertSchema(schemaName)}
                        title={schemaName}
                        data-item-id={schemaItemId}
                      >
                        <span className="expand-icon">{isSchemaExpanded ? '▼' : '▶'}</span>
                        <span className="schema-name">
                          {highlightMatch(schemaName, searchQuery)}
                          {hasMatches && <span className="match-indicator" title="Contains matches">•</span>}
                        </span>
                        <span className="table-count" title={`${schemaTables.length} tables`}>{schemaTables.length}</span>
                      </div>

                      {isSchemaExpanded && (
                        <div className="schema-tables">
                          {schemaTables.map((table) => {
                            const fullName = `${table.schema}.${table.name}`;
                            const isTableExpanded = expandedTables.has(fullName);
                            const tableHasMatch = displayMode === 'highlight' && !isTableExpanded && tableHasMatches(table);

                            const tableIcon = getTableIcon(table.type);
                            const typeTitle = table.type || 'TABLE';
                            const hasColumnsLoaded = loadedColumns.has(fullName);
                            const colCount = table.columns.length;
                            const colDisplay = hasColumnsLoaded ? colCount : '...';
                            const colTitle = hasColumnsLoaded ? `${colCount} columns` : 'Loading columns...';
                            const tableItemId = `table:${fullName}`;

                            return (
                              <div key={fullName} className="schema-table">
                                <div
                                  className={`schema-table-header ${focusedItem === tableItemId ? 'focused' : ''}`}
                                  onClick={() => toggleTable(fullName)}
                                  onDoubleClick={() => handleInsertTable(table)}
                                  title={`${fullName} (${typeTitle}, ${colTitle})`}
                                  data-item-id={tableItemId}
                                >
                                  <span className="expand-icon">{isTableExpanded ? '▼' : '▶'}</span>
                                  <span className="table-type-icon" title={typeTitle}>{tableIcon}</span>
                                  <span className="table-name">
                                    {highlightMatch(table.name, searchQuery)}
                                    {tableHasMatch && <span className="match-indicator" title="Contains matching columns">•</span>}
                                  </span>
                                  <span className="column-count-badge" title={colTitle}>{colDisplay}</span>
                                </div>

                                {isTableExpanded && (
                                  <div className="schema-columns">
                                    {loadingColumns.has(fullName) ? (
                                      <div className="schema-loading-columns">
                                        <p>Loading columns...</p>
                                      </div>
                                    ) : (
                                      table.columns.map((col) => {
                                        const colFullName = `${fullName}.${col.name}`;
                                        const colInfo = `${col.type}${col.nullable ? '' : ' NOT NULL'}`;
                                        const colItemId = `column:${colFullName}`;
                                        return (
                                          <div
                                            key={col.name}
                                            className={`schema-column ${focusedItem === colItemId ? 'focused' : ''}`}
                                            onDoubleClick={() => handleInsertColumn(table, col.name)}
                                            title={`${colFullName} (${colInfo})`}
                                            data-item-id={colItemId}
                                          >
                                            <span className="column-name">{highlightMatch(col.name, searchQuery)}</span>
                                            <span className="column-type">{col.type}</span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
