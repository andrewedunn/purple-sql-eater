// ABOUTME: Main application component with tabbed interface, connection management, and schema browser.
// ABOUTME: Manages global state for connections, tabs, and query execution with keyboard shortcuts.

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { QueryResult, QueryExecution, QueryError, ExecutionMode } from '../shared/types';
import { ConnectionDialog, ConnectionDialogResult } from './ConnectionDialog';
import { ConnectionPicker, ConnectionListItem } from './components/ConnectionPicker';
import { TabBar, Tab } from './components/TabBar';
import { SchemaBrowser } from './components/SchemaBrowser';
import { FileBrowser } from './components/FileBrowser';
import { ThemeToggle } from './components/ThemeToggle';
import { ResultsTable } from './components/ResultsTable';
import { ResultsTabs } from './components/ResultsTabs';
import { extractTableNames } from './utils/sqlParser';
import { splitQueries, getQueryAtPosition, ParsedQuery } from './utils/sqlSplitter';
import {
  getKeywordCompletions,
  getFunctionCompletions,
  getTableCompletions,
  getColumnCompletions,
  extractTableBeforeDot,
  getCompletionContext,
  buildAliasMap,
  extractTablesFromQuery,
  getMultiTableColumnCompletions,
  isInSelectClause,
  isInComment,
} from './utils/sqlCompletions';
import './design-system.css';
import './App-new.css';

const THEME_STORAGE_KEY = 'purple-sql-eater-theme';
const RECENT_TABLES_KEY = 'purple-sql-eater-recent-tables';
const LAYOUT_STORAGE_KEY = 'purple-sql-eater-layout';
const EXECUTION_MODE_KEY = 'purple-sql-eater-execution-mode';

// Platform-specific modifier key
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';
const shiftKey = isMac ? '⇧' : 'Shift+';
const enterKey = isMac ? '↵' : 'Enter';

type BrowserPosition = 'left' | 'right';
type LayoutMode = 'stacked' | 'horizontal';

interface LayoutConfig {
  schemaPosition: BrowserPosition;
  filePosition: BrowserPosition;
  layoutMode: LayoutMode;
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: '1',
      title: 'Untitled 1',
      sql: '-- Write your SQL query here\n',
      results: null,
      activeResultIndex: 0,
      isUntitled: true,
      isDirty: false,
    },
  ]);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => {
    const stored = localStorage.getItem(EXECUTION_MODE_KEY);
    return (stored as ExecutionMode) || 'current';
  });
  const [queryCount, setQueryCount] = useState(1);
  const [showExecuteMenu, setShowExecuteMenu] = useState(false);
  const executeMenuRef = useRef<HTMLDivElement>(null);
  const [executionStatus, setExecutionStatus] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState('1');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<ConnectionListItem | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSchemaBrowser, setShowSchemaBrowser] = useState(true);
  const [showFileBrowser, setShowFileBrowser] = useState(true);
  const [querySuccess, setQuerySuccess] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored as 'light' | 'dark') || 'light';
  });
  const [recentTables, setRecentTables] = useState<string[]>(() => {
    const stored = localStorage.getItem(RECENT_TABLES_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set());
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() => {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      schemaPosition: 'left',
      filePosition: 'left',
      layoutMode: 'stacked',
    };
  });
  const [schemaBrowserWidth, setSchemaBrowserWidth] = useState(300);
  const [fileBrowserWidth, setFileBrowserWidth] = useState(300);
  const [stackedSidebarWidth, setStackedSidebarWidth] = useState(300);
  const [browserSplitRatio, setBrowserSplitRatio] = useState(0.5);
  const [isResizingSchema, setIsResizingSchema] = useState(false);
  const [isResizingFile, setIsResizingFile] = useState(false);
  const [isResizingStacked, setIsResizingStacked] = useState(false);
  const [isResizingBrowsers, setIsResizingBrowsers] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartWidth = useRef(0);
  const resizeStartRatio = useRef(0.5);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [schemaTables, setSchemaTables] = useState<import('../shared/types').Table[]>([]);
  const schemaTablesRef = useRef<import('../shared/types').Table[]>([]);
  const recentTablesRef = useRef<string[]>([]);
  const executeRef = useRef<() => void>(() => {});
  const executeAllRef = useRef<() => void>(() => {});

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(RECENT_TABLES_KEY, JSON.stringify(recentTables));
  }, [recentTables]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutConfig));
  }, [layoutConfig]);

  // Persist execution mode preference
  useEffect(() => {
    localStorage.setItem(EXECUTION_MODE_KEY, executionMode);
  }, [executionMode]);

  // Count queries in current tab
  useEffect(() => {
    const count = splitQueries(activeTab.sql).length;
    setQueryCount(count);
  }, [activeTab.sql]);

  // Close execute menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (executeMenuRef.current && !executeMenuRef.current.contains(e.target as Node)) {
        setShowExecuteMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch schema tables when connected (for autocomplete)
  useEffect(() => {
    if (!isConnected) {
      setSchemaTables([]);
      return;
    }

    const fetchSchema = async () => {
      try {
        console.log('App-new: Fetching schema for autocomplete...');
        const schema = await window.electron.getSchema();
        console.log('App-new: Got schema with', schema?.tables?.length || 0, 'tables');
        const tables = schema.tables || [];
        setSchemaTables(tables);
        schemaTablesRef.current = tables;
      } catch (err) {
        console.error('Failed to fetch schema for autocomplete:', err);
      }
    };

    fetchSchema();
  }, [isConnected, currentConnection?.id]);

  // Keep recentTablesRef in sync
  useEffect(() => {
    recentTablesRef.current = recentTables;
  }, [recentTables]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  
  const handleConnect = async (result: ConnectionDialogResult) => {
    setConnectionError(null);
    try {
      await window.electron.connect(result.config);

      const connectionId = Date.now().toString();
      const connection: ConnectionListItem = {
        id: connectionId,
        name: result.name,
        type: result.config.type,
      };

      if (result.saveConnection) {
        await window.electron.connectionsSave({
          id: connectionId,
          name: result.name,
          config: result.config,
        });
      }

      setCurrentConnection(connection);
      setIsConnected(true);
      setShowConnectionDialog(false);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handlePickerConnect = async (connectionId: string, connectionName: string) => {
    setConnectionError(null);
    try {
      const savedConnection = await window.electron.connectionsConnect(connectionId);
      setCurrentConnection({
        id: connectionId,
        name: connectionName,
        type: savedConnection.config.type,
      });
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
    if (!isConnected || !activeTab || !editorRef.current) return;

    setError(null);
    setIsExecuting(true);
    setQuerySuccess(false);
    setExecutionStatus(null);

    try {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const position = editor.getPosition();

      let queriesToRun: ParsedQuery[] = [];

      // Determine which queries to run based on context
      if (selection && !selection.isEmpty()) {
        // Selection takes priority - split selected text into queries
        const model = editor.getModel();
        if (model) {
          const selectedText = model.getValueInRange(selection);
          const parsedQueries = splitQueries(selectedText);
          // Adjust line numbers to be relative to selection start
          queriesToRun = parsedQueries.map(q => ({
            ...q,
            startLine: selection.startLineNumber + q.startLine - 1,
            endLine: selection.startLineNumber + q.endLine - 1,
          }));
        }
      } else if (executionMode === 'current' && position) {
        // Run query at cursor position
        const query = getQueryAtPosition(activeTab.sql, position.lineNumber, position.column);
        if (query) {
          queriesToRun = [query];
        }
      } else {
        // Run all queries
        queriesToRun = splitQueries(activeTab.sql);
      }

      if (queriesToRun.length === 0) {
        setError('No query to execute');
        setIsExecuting(false);
        return;
      }

      // Execute queries sequentially
      const results: (QueryResult | QueryError)[] = [];
      const allTableNames: string[] = [];

      for (let i = 0; i < queriesToRun.length; i++) {
        const query = queriesToRun[i];
        setExecutionStatus(`Executing ${i + 1} of ${queriesToRun.length}...`);

        try {
          const result = await window.electron.executeQuery(query.sql);
          results.push(result);

          // Track table names from successful queries
          const tableNames = extractTableNames(query.sql);
          allTableNames.push(...tableNames);
        } catch (err) {
          results.push({
            error: err instanceof Error ? err.message : 'Unknown error',
            query: query.sql,
          });
        }
      }

      // Build QueryExecution object
      const execution: QueryExecution = {
        queries: queriesToRun.map(q => ({
          sql: q.sql,
          startLine: q.startLine,
          endLine: q.endLine,
        })),
        results,
        resultFilters: results.map(() => []), // Initialize empty filters for each result
        executedAt: new Date(),
      };

      setTabs(tabs.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, results: execution, activeResultIndex: 0 }
          : tab
      ));

      // Track recently queried tables
      if (allTableNames.length > 0) {
        setRecentTables((prev) => {
          const unique = [...new Set(allTableNames)];
          const updated = [...unique, ...prev.filter(t => !unique.includes(t))];
          return updated.slice(0, 10);
        });
      }

      // Update status
      const successCount = results.filter(r => !('error' in r)).length;
      const errorCount = results.filter(r => 'error' in r).length;
      if (errorCount > 0) {
        setExecutionStatus(`Executed ${successCount} of ${results.length} (${errorCount} failed)`);
      } else {
        setExecutionStatus(`Executed ${results.length} ${results.length === 1 ? 'query' : 'queries'}`);
      }

      setQuerySuccess(true);
      setTimeout(() => setQuerySuccess(false), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Keep refs updated for Monaco editor actions (avoids stale closure issue)
  useEffect(() => {
    executeRef.current = () => {
      if (isConnected && !isExecuting) {
        handleExecute();
      }
    };
    executeAllRef.current = () => {
      if (isConnected && !isExecuting) {
        const originalMode = executionMode;
        setExecutionMode('all');
        setTimeout(() => {
          handleExecute();
          setExecutionMode(originalMode);
        }, 0);
      }
    };
  });

  // Keyboard shortcuts - must be after handleExecute is defined
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isConnected || isExecuting) return;

        if (e.shiftKey) {
          // Cmd+Shift+Enter: Execute All - temporarily set mode to 'all'
          const originalMode = executionMode;
          setExecutionMode('all');
          setTimeout(() => {
            handleExecute();
            setExecutionMode(originalMode);
          }, 0);
        } else {
          // Cmd+Enter: Execute based on current mode
          handleExecute();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleFileSaveAs(activeTabId);
        } else {
          handleFileSave(activeTabId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleSqlChange = (sql: string) => {
    setTabs(tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, sql, isDirty: true } : tab
    ));
  };

  const handleNewTab = () => {
    const newId = Date.now().toString();
    const newTab: Tab = {
      id: newId,
      title: `Untitled ${tabs.length + 1}`,
      sql: '-- Write your SQL query here\n',
      results: null,
      activeResultIndex: 0,
      isUntitled: true,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.isDirty) {
      const confirmed = window.confirm(
        `"${tab.title}" has unsaved changes. Close anyway?`
      );
      if (!confirmed) return;
    }

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

    const activeResult = activeTab.results.results[activeTab.activeResultIndex];
    if (!activeResult || 'error' in activeResult) return;

    const { columns, rows } = activeResult;
    const csvContent = [
      columns.join(','),
      ...rows.map((row: unknown[]) =>
        row.map((cell: unknown) => {
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

    const activeResult = activeTab.results.results[activeTab.activeResultIndex];
    if (!activeResult || 'error' in activeResult) return;

    const { columns, rows } = activeResult;
    const tsvContent = [
      columns.join('\t'),
      ...rows.map((row: unknown[]) => row.map((cell: unknown) => String(cell ?? '')).join('\t')),
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

  const handleFileSave = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.isUntitled || !tab.filePath) {
      await handleFileSaveAs(tabId);
      return;
    }

    try {
      await window.electron.fileWrite(tab.filePath, tab.sql);
      setTabs(tabs.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  };

  const handleFileSaveAs = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    try {
      const filePath = await window.electron.fileSaveDialog();
      if (!filePath) return;

      await window.electron.fileWrite(filePath, tab.sql);
      const fileName = filePath.split('/').pop() || 'Untitled';

      setTabs(
        tabs.map((t) =>
          t.id === tabId
            ? { ...t, title: fileName, filePath, isDirty: false, isUntitled: false }
            : t
        )
      );

      await window.electron.recentFilesAdd(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  };

  const handleFileOpen = async (filePath: string) => {
    try {
      // Check if file is already open
      const existingTab = tabs.find((t) => t.filePath === filePath);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }

      // Read file content
      const content = await window.electron.fileRead(filePath);
      const fileName = filePath.split('/').pop() || 'Untitled';

      // Replace current tab if it's untitled and empty
      if (activeTab.isUntitled && !activeTab.isDirty && activeTab.sql === '-- Write your SQL query here\n') {
        setTabs(
          tabs.map((tab) =>
            tab.id === activeTabId
              ? { ...tab, title: fileName, sql: content, filePath, isUntitled: false, isDirty: false }
              : tab
          )
        );
      } else {
        // Create new tab
        const newId = Date.now().toString();
        const newTab: Tab = {
          id: newId,
          title: fileName,
          sql: content,
          results: null,
          activeResultIndex: 0,
          filePath,
          isUntitled: false,
          isDirty: false,
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
      }

      await window.electron.recentFilesAdd(filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
    }
  };

  // Layout handlers
  const handleSchemaPositionChange = (position: BrowserPosition) => {
    setLayoutConfig(prev => ({ ...prev, schemaPosition: position }));
  };

  const handleFilePositionChange = (position: BrowserPosition) => {
    setLayoutConfig(prev => ({ ...prev, filePosition: position }));
  };

  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutConfig(prev => ({ ...prev, layoutMode: mode }));
  };

  // Determine if both browsers are on the same side
  const bothOnSameSide = layoutConfig.schemaPosition === layoutConfig.filePosition;
  const showLayoutModeOption = bothOnSameSide;

  // Browser resize handlers
  const handleSchemaBrowserResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSchema(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = schemaBrowserWidth;
  };

  const handleFileBrowserResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingFile(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = fileBrowserWidth;
  };

  const handleStackedSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingStacked(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = stackedSidebarWidth;
  };

  const handleBrowsersResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingBrowsers(true);
    resizeStartY.current = e.clientY;
    resizeStartRatio.current = browserSplitRatio;
  };

  useEffect(() => {
    if (!isResizingSchema) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const directedDelta = layoutConfig.schemaPosition === 'right' ? -delta : delta;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidth.current + directedDelta));
      setSchemaBrowserWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSchema(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSchema, layoutConfig.schemaPosition]);

  useEffect(() => {
    if (!isResizingFile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const directedDelta = layoutConfig.filePosition === 'right' ? -delta : delta;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidth.current + directedDelta));
      setFileBrowserWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingFile(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingFile, layoutConfig.filePosition]);

  useEffect(() => {
    if (!isResizingStacked) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      // Stacked sidebar is only used when both browsers are on the same side
      const isOnRight = layoutConfig.schemaPosition === 'right';
      const directedDelta = isOnRight ? -delta : delta;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidth.current + directedDelta));
      setStackedSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingStacked(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingStacked, layoutConfig.schemaPosition]);

  useEffect(() => {
    if (!isResizingBrowsers) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.querySelector('.sidebar');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const deltaY = e.clientY - resizeStartY.current;
      const containerHeight = rect.height;
      const deltaRatio = deltaY / containerHeight;
      const newRatio = Math.max(0.2, Math.min(0.8, resizeStartRatio.current + deltaRatio));
      setBrowserSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsResizingBrowsers(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingBrowsers]);

  // Warn before closing window with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasDirtyTabs = tabs.some((t) => t.isDirty);
      if (hasDirtyTabs) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  // Watch all open tab files for external changes
  useEffect(() => {
    const filePaths = tabs
      .filter((tab) => tab.filePath && !tab.isUntitled)
      .map((tab) => tab.filePath!);

    // Watch all file paths
    filePaths.forEach((filePath) => {
      window.electron.fileWatch(filePath);
    });

    // Cleanup: unwatch files that are no longer open
    return () => {
      filePaths.forEach((filePath) => {
        window.electron.fileUnwatch(filePath);
      });
    };
  }, [tabs]);

  // Listen for file-changed events from main process
  // Note: Using useRef to avoid recreating handlers on every tabs change
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    const handleFileChanged = (_event: any, filePath: string) => {
      // Add to changed files set
      setChangedFiles((prev) => new Set(prev).add(filePath));
    };

    const handleFileDeleted = (_event: any, filePath: string) => {
      const tab = tabsRef.current.find((t) => t.filePath === filePath);
      if (tab) {
        const confirmed = window.confirm(
          `"${tab.title}" was deleted externally. Close this tab?`
        );
        if (confirmed) {
          handleCloseTab(tab.id);
        }
      }
    };

    const handleFileRenamed = (_event: any, oldPath: string, newPath: string) => {
      // Update any tab that references the old path
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.filePath === oldPath) {
          // Extract new filename for title
          const newName = newPath.split('/').pop() || newPath;
          return { ...tab, filePath: newPath, title: newName };
        }
        return tab;
      }));
    };

    if (window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('file-changed', handleFileChanged);
      window.electron.ipcRenderer.on('file-deleted', handleFileDeleted);
      window.electron.ipcRenderer.on('file-renamed', handleFileRenamed);

      return () => {
        window.electron.ipcRenderer?.removeListener('file-changed', handleFileChanged);
        window.electron.ipcRenderer?.removeListener('file-deleted', handleFileDeleted);
        window.electron.ipcRenderer?.removeListener('file-renamed', handleFileRenamed);
      };
    }
  }, []); // Empty deps - only run on mount/unmount

  // Handle file reload
  const handleReloadFile = async (filePath: string) => {
    try {
      const content = await window.electron.fileRead(filePath);
      setTabs(
        tabs.map((tab) =>
          tab.filePath === filePath
            ? { ...tab, sql: content, isDirty: false }
            : tab
        )
      );
      setChangedFiles((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload file');
    }
  };

  // Handle schema loaded from SchemaBrowser (includes columns)
  const handleSchemaLoaded = (tables: import('../shared/types').Table[]) => {
    console.log('App-new: Schema with columns loaded:', tables.length, 'tables');
    setSchemaTables(tables);
    schemaTablesRef.current = tables;
  };

  // Render components with layout props
  const renderSchemaBrowser = () => (
    <SchemaBrowser
      isVisible={showSchemaBrowser}
      onToggle={() => setShowSchemaBrowser(!showSchemaBrowser)}
      isConnected={isConnected}
      onInsertText={handleInsertText}
      recentTables={recentTables}
      connectionId={currentConnection?.id}
      position={layoutConfig.schemaPosition}
      onPositionChange={handleSchemaPositionChange}
      showLayoutMode={showLayoutModeOption && layoutConfig.schemaPosition === layoutConfig.filePosition}
      layoutMode={layoutConfig.layoutMode}
      onLayoutModeChange={handleLayoutModeChange}
      onSchemaLoaded={handleSchemaLoaded}
    />
  );

  const renderFileBrowser = () => (
    <FileBrowser
      isVisible={showFileBrowser}
      onToggle={() => setShowFileBrowser(!showFileBrowser)}
      onFileOpen={handleFileOpen}
      connectionId={currentConnection?.id}
      position={layoutConfig.filePosition}
      onPositionChange={handleFilePositionChange}
      showLayoutMode={showLayoutModeOption && layoutConfig.schemaPosition === layoutConfig.filePosition}
      layoutMode={layoutConfig.layoutMode}
      onLayoutModeChange={handleLayoutModeChange}
    />
  );

  const renderMainPanel = () => (
    <div className="main-panel">
      <div className="editor-container">
        {activeTab.filePath && changedFiles.has(activeTab.filePath) && (
          <div className="file-changed-banner">
            <span>This file was changed externally.</span>
            <button
              onClick={() => handleReloadFile(activeTab.filePath!)}
              className="btn-reload"
            >
              Reload
            </button>
            <button
              onClick={() => {
                setChangedFiles((prev) => {
                  const next = new Set(prev);
                  next.delete(activeTab.filePath!);
                  return next;
                });
              }}
              className="btn-dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={activeTab.sql}
          onChange={(value) => handleSqlChange(value || '')}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          beforeMount={(monaco) => {
            monacoRef.current = monaco;
            // Register SQL completion provider
            monaco.languages.registerCompletionItemProvider('sql', {
              triggerCharacters: ['.', ' '],
              provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
                const fullText = model.getValue();
                const cursorOffset = model.getOffsetAt(position);

                // Don't provide completions inside comments
                if (isInComment(fullText, cursorOffset)) {
                  return { suggestions: [] };
                }

                const word = model.getWordUntilPosition(position);
                const range = {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: word.startColumn,
                  endColumn: word.endColumn,
                };

                const lineText = model.getValueInRange({
                  startLineNumber: position.lineNumber,
                  startColumn: 1,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                });

                const context = getCompletionContext(lineText);
                const suggestions: Monaco.languages.CompletionItem[] = [];

                // Use refs to get current values (closure would capture stale state)
                const tables = schemaTablesRef.current;
                const recent = recentTablesRef.current;

                console.log('Autocomplete context:', { lineText, context, schemaTablesCount: tables.length });

                if (context === 'column') {
                  // After a dot - could be schema.table or table.column
                  const identifier = extractTableBeforeDot(lineText);
                  console.log('After dot, identifier:', identifier);
                  if (identifier) {
                    // Check if it's a schema/dataset name
                    const schemas = tables.map(t => t.schema).filter(Boolean);
                    console.log('Available schemas:', [...new Set(schemas)]);
                    const isSchema = tables.some(t =>
                      t.schema?.toLowerCase() === identifier.toLowerCase()
                    );
                    console.log('Is schema?', isSchema);

                    if (isSchema) {
                      // It's a schema - show tables in that schema
                      const tableSuggestions = getTableCompletions(monaco, tables, range, recent, identifier);
                      console.log('Table suggestions for schema:', tableSuggestions.length);
                      suggestions.push(...tableSuggestions);
                    } else {
                      // It's a table - show columns
                      // Check if it's an alias first
                      const aliasMap = buildAliasMap(model.getValue());
                      console.log('Alias map:', Object.fromEntries(aliasMap));
                      const resolvedTable = aliasMap.get(identifier.toLowerCase()) || identifier;
                      console.log('Resolved table:', resolvedTable);
                      const colSuggestions = getColumnCompletions(monaco, tables, resolvedTable, range);
                      console.log('Column suggestions:', colSuggestions.length);
                      suggestions.push(...colSuggestions);
                    }
                  }
                } else if (context === 'table') {
                  // After FROM/JOIN - provide table completions
                  suggestions.push(...getTableCompletions(monaco, tables, range, recent));
                } else {
                  // Default context - check if we're in SELECT clause with tables
                  const fullSql = model.getValue();
                  const queryTables = extractTablesFromQuery(fullSql);
                  const cursorOffset = model.getOffsetAt(position);
                  const inSelect = isInSelectClause(fullSql, cursorOffset);

                  console.log('Default context:', { queryTablesCount: queryTables.length, inSelect, tablesLoaded: tables.length });

                  if (inSelect && queryTables.length > 0 && tables.length > 0) {
                    // In SELECT with tables defined - show ONLY columns and functions, no random tables
                    const columnSuggestions = getMultiTableColumnCompletions(monaco, tables, queryTables, range, true);
                    console.log('SELECT context - columns only:', columnSuggestions.length);
                    suggestions.push(...columnSuggestions);
                    suggestions.push(...getFunctionCompletions(monaco, range));
                  } else {
                    // Not in SELECT, or no tables yet, or schema not loaded - show everything
                    suggestions.push(...getKeywordCompletions(monaco, range));
                    suggestions.push(...getFunctionCompletions(monaco, range));
                    if (queryTables.length > 0 && tables.length > 0) {
                      const columnSuggestions = getMultiTableColumnCompletions(monaco, tables, queryTables, range, false);
                      suggestions.push(...columnSuggestions);
                    }
                    suggestions.push(...getTableCompletions(monaco, tables, range, recent));
                  }
                }

                return { suggestions };
              },
            });
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;

            // Add Cmd/Ctrl+Enter keybinding to execute query
            // Uses ref to avoid stale closure issue
            editor.addAction({
              id: 'execute-query',
              label: 'Execute Query',
              keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
              ],
              run: () => executeRef.current(),
            });

            // Add Cmd/Ctrl+Shift+Enter keybinding to execute all queries
            editor.addAction({
              id: 'execute-all-queries',
              label: 'Execute All Queries',
              keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
              ],
              run: () => executeAllRef.current(),
            });
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 12 },
            fontFamily: 'IBM Plex Mono, Monaco, Menlo, Consolas, monospace',
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>

      <div className="results-container">
        {error && <div className="error">{error}</div>}

        {activeTab.results && (
          <>
            <ResultsTabs
              execution={activeTab.results}
              activeResultIndex={activeTab.activeResultIndex}
              onResultChange={(index) => {
                setTabs(tabs.map(t =>
                  t.id === activeTabId ? { ...t, activeResultIndex: index } : t
                ));
              }}
            />
            {(() => {
              const result = activeTab.results.results[activeTab.activeResultIndex];
              if (!result) return null;
              if ('error' in result) {
                return (
                  <div className="query-error">
                    <div className="query-error-title">Query Error</div>
                    <div className="query-error-message">{result.error}</div>
                    <div className="query-error-sql">{result.query}</div>
                  </div>
                );
              }
              const currentFilters = activeTab.results.resultFilters[activeTab.activeResultIndex] || [];
              return (
                <ResultsTable
                  results={result}
                  filters={currentFilters}
                  onFiltersChange={(newFilters) => {
                    setTabs(tabs.map(t => {
                      if (t.id !== activeTabId || !t.results) return t;
                      const updatedFilters = [...t.results.resultFilters];
                      updatedFilters[t.activeResultIndex] = newFilters;
                      return {
                        ...t,
                        results: {
                          ...t.results,
                          resultFilters: updatedFilters,
                        },
                      };
                    }));
                  }}
                  onExportCSV={handleExportCSV}
                  onCopyToClipboard={handleCopyToClipboard}
                />
              );
            })()}
          </>
        )}
      </div>
    </div>
  );

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

        <div className="execute-group" ref={executeMenuRef}>
          {queryCount <= 1 ? (
            // Single query: simple execute button
            <button
              className="btn-execute btn-execute-single"
              onClick={handleExecute}
              disabled={isExecuting || !isConnected}
              title={`Execute query (${modKey}${enterKey})`}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
              <span className="btn-shortcut">{modKey}{enterKey}</span>
            </button>
          ) : (
            // Multiple queries: button with dropdown
            <>
              <button
                className="btn-execute"
                onClick={handleExecute}
                disabled={isExecuting || !isConnected}
                title={executionMode === 'current' ? `Execute current query (${modKey}${enterKey})` : `Execute all queries (${modKey}${enterKey})`}
              >
                {isExecuting ? 'Executing...' : executionMode === 'current' ? 'Execute Current' : 'Execute All'}
              </button>
              <button
                className="btn-execute-dropdown"
                onClick={() => setShowExecuteMenu(!showExecuteMenu)}
                disabled={isExecuting || !isConnected}
                title="Execution options"
              >
                ▾
              </button>
              {showExecuteMenu && (
                <div className="execute-menu">
                  <button
                    className={`execute-menu-item ${executionMode === 'current' ? 'active' : ''}`}
                    onClick={() => {
                      setExecutionMode('current');
                      setShowExecuteMenu(false);
                    }}
                  >
                    <span className="execute-menu-label">Execute Current</span>
                    <span className="execute-menu-shortcut">{modKey}{enterKey}</span>
                  </button>
                  <button
                    className={`execute-menu-item ${executionMode === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setExecutionMode('all');
                      setShowExecuteMenu(false);
                    }}
                  >
                    <span className="execute-menu-label">Execute All ({queryCount})</span>
                    <span className="execute-menu-shortcut">{modKey}{shiftKey}{enterKey}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {executionStatus && (
          <span className={`execution-status ${querySuccess ? 'pulse-once' : ''}`}>
            {executionStatus}
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
        {/* Schema browser on left - horizontal mode or alone */}
        {showSchemaBrowser && layoutConfig.schemaPosition === 'left' &&
         (layoutConfig.filePosition !== 'left' || layoutConfig.layoutMode === 'horizontal') && (
          <div className="browser-panel" style={{ width: `${schemaBrowserWidth}px` }}>
            {renderSchemaBrowser()}
            <div className="resize-handle-browser" onMouseDown={handleSchemaBrowserResizeStart} title="Drag to resize"></div>
          </div>
        )}

        {/* File browser on left - horizontal mode or alone */}
        {showFileBrowser && layoutConfig.filePosition === 'left' &&
         (layoutConfig.schemaPosition !== 'left' || layoutConfig.layoutMode === 'horizontal') && (
          <div className="browser-panel" style={{ width: `${fileBrowserWidth}px` }}>
            {renderFileBrowser()}
            <div className="resize-handle-browser" onMouseDown={handleFileBrowserResizeStart} title="Drag to resize"></div>
          </div>
        )}

        {/* Both browsers on left - stacked mode */}
        {showSchemaBrowser && showFileBrowser &&
         layoutConfig.schemaPosition === 'left' && layoutConfig.filePosition === 'left' &&
         layoutConfig.layoutMode === 'stacked' && (
          <div className="sidebar sidebar-stacked" style={{ width: `${stackedSidebarWidth}px` }}>
            <div className="browser-container" style={{ flex: browserSplitRatio }}>
              {renderSchemaBrowser()}
            </div>
            <div className="resize-handle-browsers vertical" onMouseDown={handleBrowsersResizeStart} title="Drag to resize"></div>
            <div className="browser-container" style={{ flex: 1 - browserSplitRatio }}>
              {renderFileBrowser()}
            </div>
            <div className="resize-handle-sidebar" onMouseDown={handleStackedSidebarResizeStart} title="Drag to resize"></div>
          </div>
        )}

        {/* Main panel in center */}
        {renderMainPanel()}

        {/* Schema browser on right - horizontal mode or alone */}
        {showSchemaBrowser && layoutConfig.schemaPosition === 'right' &&
         (layoutConfig.filePosition !== 'right' || layoutConfig.layoutMode === 'horizontal') && (
          <div className="browser-panel browser-panel-right" style={{ width: `${schemaBrowserWidth}px` }}>
            <div className="resize-handle-browser resize-handle-left" onMouseDown={handleSchemaBrowserResizeStart} title="Drag to resize"></div>
            {renderSchemaBrowser()}
          </div>
        )}

        {/* File browser on right - horizontal mode or alone */}
        {showFileBrowser && layoutConfig.filePosition === 'right' &&
         (layoutConfig.schemaPosition !== 'right' || layoutConfig.layoutMode === 'horizontal') && (
          <div className="browser-panel browser-panel-right" style={{ width: `${fileBrowserWidth}px` }}>
            <div className="resize-handle-browser resize-handle-left" onMouseDown={handleFileBrowserResizeStart} title="Drag to resize"></div>
            {renderFileBrowser()}
          </div>
        )}

        {/* Both browsers on right - stacked mode */}
        {showSchemaBrowser && showFileBrowser &&
         layoutConfig.schemaPosition === 'right' && layoutConfig.filePosition === 'right' &&
         layoutConfig.layoutMode === 'stacked' && (
          <div className="sidebar sidebar-stacked sidebar-right" style={{ width: `${stackedSidebarWidth}px` }}>
            <div className="resize-handle-sidebar resize-handle-left" onMouseDown={handleStackedSidebarResizeStart} title="Drag to resize"></div>
            <div className="browser-container" style={{ flex: browserSplitRatio }}>
              {renderSchemaBrowser()}
            </div>
            <div className="resize-handle-browsers vertical" onMouseDown={handleBrowsersResizeStart} title="Drag to resize"></div>
            <div className="browser-container" style={{ flex: 1 - browserSplitRatio }}>
              {renderFileBrowser()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
