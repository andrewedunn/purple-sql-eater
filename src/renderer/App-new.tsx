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
import { FileBrowser } from './components/FileBrowser';
import { ThemeToggle } from './components/ThemeToggle';
import { ResultsTable } from './components/ResultsTable';
import { extractTableNames } from './utils/sqlParser';
import './design-system.css';
import './App-new.css';

const THEME_STORAGE_KEY = 'purple-sql-eater-theme';
const RECENT_TABLES_KEY = 'purple-sql-eater-recent-tables';
const LAYOUT_STORAGE_KEY = 'purple-sql-eater-layout';

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
      isUntitled: true,
      isDirty: false,
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
  useEffect(() => {
    const handleFileChanged = (_event: any, filePath: string) => {
      // Add to changed files set
      setChangedFiles((prev) => new Set(prev).add(filePath));
    };

    const handleFileDeleted = (_event: any, filePath: string) => {
      const tab = tabs.find((t) => t.filePath === filePath);
      if (tab) {
        const confirmed = window.confirm(
          `"${tab.title}" was deleted externally. Close this tab?`
        );
        if (confirmed) {
          handleCloseTab(tab.id);
        }
      }
    };

    if (window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('file-changed', handleFileChanged);
      window.electron.ipcRenderer.on('file-deleted', handleFileDeleted);

      return () => {
        window.electron.ipcRenderer?.removeListener('file-changed', handleFileChanged);
        window.electron.ipcRenderer?.removeListener('file-deleted', handleFileDeleted);
      };
    }
  }, [tabs]);

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
