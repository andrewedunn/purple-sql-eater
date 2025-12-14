// ABOUTME: Main application component with tabbed interface, connection management, and schema browser.
// ABOUTME: Manages global state for connections, tabs, and query execution with keyboard shortcuts.

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { QueryResult, ConnectionConfig } from '../shared/types';
import { ConnectionDialog, ConnectionDialogResult } from './ConnectionDialog';
import { ConnectionPicker, SavedConnection, saveConnection } from './components/ConnectionPicker';
import { TabBar, Tab } from './components/TabBar';
import { SchemaBrowser } from './components/SchemaBrowser';
import { ThemeToggle } from './components/ThemeToggle';
import { ResultsTable } from './components/ResultsTable';
import { extractTableNames } from './utils/sqlParser';
import './design-system.css';
import './App-new.css';

const THEME_STORAGE_KEY = 'purple-sql-eater-theme';
const RECENT_TABLES_KEY = 'purple-sql-eater-recent-tables';

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: '1',
      title: 'Query 1',
      sql: '-- Write your SQL query here\nSELECT 1 as test',
      results: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<SavedConnection | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(true);
  const [querySuccess, setQuerySuccess] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as 'light' | 'dark') || 'light';
  });
  const [recentTables, setRecentTables] = useState<string[]>(() => {
    const stored = localStorage.getItem(RECENT_TABLES_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(RECENT_TABLES_KEY, JSON.stringify(recentTables));
  }, [recentTables]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, isConnected]);

  const handleConnect = async (result: ConnectionDialogResult) => {
    setConnectionError(null);
    try {
      await window.electron.connect(result.config);

      const connection: SavedConnection = {
        id: Date.now().toString(),
        name: result.name,
        config: result.config,
      };

      if (result.saveConnection) {
        saveConnection(connection);
      }

      setCurrentConnection(connection);
      setIsConnected(true);
      setShowConnectionDialog(false);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handlePickerConnect = async (connection: SavedConnection) => {
    setConnectionError(null);
    try {
      await window.electron.connect(connection.config);
      setCurrentConnection(connection);
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.electron.disconnect();
      setIsConnected(false);
      setCurrentConnection(null);
      setTabs(tabs.map((tab) => ({ ...tab, results: null })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const handleExecute = async () => {
    if (!isConnected || !activeTab) return;

    setError(null);
    setIsExecuting(true);
    setQuerySuccess(false);

    try {
      const result = await window.electron.executeQuery(activeTab.sql);

      setTabs(tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, results: result } : tab
      ));

      // Track recently queried tables
      const tableNames = extractTableNames(activeTab.sql);
      if (tableNames.length > 0) {
        setRecentTables((prev) => {
          const updated = [...tableNames, ...prev.filter(t => !tableNames.includes(t))];
          return updated.slice(0, 10); // Keep only the 10 most recent
        });
      }

      setQuerySuccess(true);
      setTimeout(() => setQuerySuccess(false), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSqlChange = (sql: string) => {
    setTabs(tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, sql } : tab
    ));
  };

  const handleNewTab = () => {
    const newId = Date.now().toString();
    const newTab: Tab = {
      id: newId,
      title: `Query ${tabs.length + 1}`,
      sql: '-- Write your SQL query here\n',
      results: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);

    if (tabId === activeTabId) {
      const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
      setActiveTabId(newActiveTab.id);
    }

    setTabs(newTabs);
  };

  const handleRenameTab = (tabId: string, newTitle: string) => {
    setTabs(tabs.map((tab) =>
      tab.id === tabId ? { ...tab, title: newTitle } : tab
    ));
  };

  const handleExportCSV = () => {
    if (!activeTab.results) return;

    const { columns, rows } = activeTab.results;
    const csvContent = [
      columns.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          const value = String(cell ?? '');
          return value.includes(',') || value.includes('"') || value.includes('\n')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!activeTab.results) return;

    const { columns, rows } = activeTab.results;
    const tsvContent = [
      columns.join('\t'),
      ...rows.map((row) => row.map((cell) => String(cell ?? '')).join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsvContent);
  };

  const handleInsertText = (text: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits('schema-browser', [
      {
        range: selection,
        text,
        forceMoveMarkers: true,
      },
    ]);

    editor.focus();
  };

  return (
    <div className="app">
      {showConnectionDialog && (
        <ConnectionDialog
          onConnect={handleConnect}
          onCancel={() => {
            setShowConnectionDialog(false);
            setConnectionError(null);
          }}
          externalError={connectionError}
        />
      )}

      <div className="toolbar">
        <ConnectionPicker
          onConnect={handlePickerConnect}
          onDisconnect={handleDisconnect}
          isConnected={isConnected}
          currentConnection={currentConnection}
          onShowConnectionDialog={() => setShowConnectionDialog(true)}
        />

        <div className="toolbar-spacer"></div>

        <button
          className="btn-execute"
          onClick={handleExecute}
          disabled={isExecuting || !isConnected}
          title="Execute query (Cmd+Enter)"
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </button>

        {activeTab.results && (
          <span className={`results-count ${querySuccess ? 'pulse-once' : ''}`}>
            {activeTab.results.rowCount} row{activeTab.results.rowCount !== 1 ? 's' : ''}
          </span>
        )}

        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onTabClose={handleCloseTab}
        onTabAdd={handleNewTab}
        onTabRename={handleRenameTab}
      />

      <div className="content">
        <SchemaBrowser
          isVisible={showSchemaBrowser}
          onToggle={() => setShowSchemaBrowser(!showSchemaBrowser)}
          isConnected={isConnected}
          onInsertText={handleInsertText}
          recentTables={recentTables}
          connectionId={currentConnection?.id}
        />

        <div className="main-panel">
          <div className="editor-container">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={activeTab.sql}
              onChange={(value) => handleSqlChange(value || '')}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 12 },
                fontFamily: 'IBM Plex Mono, Monaco, Menlo, Consolas, monospace',
              }}
            />
          </div>

          <div className="results-container">
            {error && <div className="error">{error}</div>}

            {activeTab.results && (
              <ResultsTable
                results={activeTab.results}
                onExportCSV={handleExportCSV}
                onCopyToClipboard={handleCopyToClipboard}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
