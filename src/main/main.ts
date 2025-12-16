// ABOUTME: Electron main process that manages the application window and IPC handlers.
// ABOUTME: Handles database connections and query execution in the Node.js environment.

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import type { ConnectionConfig, QueryResult, DatabaseConnector, SearchOptions } from '../shared/types';
import { BigQueryConnector } from './connectors/bigquery';
import { FileSystemService } from './services/FileSystemService';
import { WorkspaceService } from './services/WorkspaceService';
import { FileWatcherService } from './services/FileWatcherService';
import { SecureConnectionStorage } from './services/SecureConnectionStorage';

let mainWindow: BrowserWindow | null = null;
let connector: DatabaseConnector | null = null;

// File system services
const fileSystemService = new FileSystemService();
const workspaceService = new WorkspaceService(fileSystemService);
const fileWatcherService = new FileWatcherService();
const connectionStorage = new SecureConnectionStorage();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    fileWatcherService.unwatchAll();
    mainWindow = null;
  });

  fileWatcherService.setWindow(mainWindow);
}

app.whenReady().then(() => {
  // Set up application menu (required for Cmd+Q to work on macOS)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createWindow();
});

app.on('window-all-closed', () => {
  // On macOS, quit when window is closed (not typical macOS behavior, but simpler for now)
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle quit properly - clean up and exit
app.on('before-quit', () => {
  fileWatcherService.unwatchAll();
});

// Helper to validate file paths from renderer
function validateFilePath(filePath: unknown): asserts filePath is string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string');
  }

  if (filePath.includes('\0')) {
    throw new Error('Invalid file path: null bytes not allowed');
  }

  if (filePath.length > 4096) {
    throw new Error('Invalid file path: path too long (max 4096 characters)');
  }
}

// Sanitize sensitive data from logs
function sanitizeArgs(channel: string, args: any[]): any[] {
  // Don't log credentials or sensitive connection data
  if (channel === 'connect') {
    return ['<connection config redacted>'];
  }
  // Truncate long content
  if (channel === 'file-write' && args[2]?.length > 100) {
    return [args[1], `<content: ${args[2].length} bytes>`];
  }
  if (channel === 'file-create' && args[2]?.length > 100) {
    return [args[1], `<content: ${args[2].length} bytes>`];
  }
  return args.slice(1); // Remove _event argument
}

// Helper to wrap IPC handlers with comprehensive error logging
function handleIPC<T extends (...args: any[]) => any>(
  channel: string,
  handler: T
): void {
  ipcMain.handle(channel, async (...args) => {
    const startTime = Date.now();
    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      // Log slow operations for performance monitoring
      if (duration > 1000) {
        console.warn(`IPC handler '${channel}' completed slowly: ${duration}ms`);
      }

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;

      // Comprehensive error logging for debugging
      console.error(`IPC handler '${channel}' failed after ${duration}ms:`, {
        error: err.message,
        code: err.code,
        args: sanitizeArgs(channel, args),
        timestamp: new Date().toISOString(),
      });

      // Re-throw with enhanced message for client
      const enhancedError = new Error(
        `Operation '${channel}' failed: ${err.message}`
      );
      (enhancedError as any).code = err.code;
      throw enhancedError;
    }
  });
}

handleIPC('connect', async (_event, config: ConnectionConfig) => {
  if (config.type === 'bigquery') {
    connector = new BigQueryConnector();
    await connector.connect(config);
  } else {
    throw new Error(`Unsupported database type: ${config.type}`);
  }
});

handleIPC('disconnect', async () => {
  if (connector) {
    await connector.disconnect();
    connector = null;
  }
});

handleIPC('execute-query', async (_event, sql: string): Promise<QueryResult> => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }
  return await connector.query(sql);
});

handleIPC('get-schema', async (event) => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }

  // Stream progress back to renderer
  if (connector instanceof BigQueryConnector) {
    return await connector.getSchemaWithProgress((current, total) => {
      event.sender.send('schema-progress', { current, total });
    });
  }

  return await connector.getSchema();
});

handleIPC('get-columns', async (_event, tableName: string) => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }
  return await connector.getColumns(tableName);
});

// File system IPC handlers
handleIPC('workspace-select', async () => {
  return await workspaceService.selectWorkspaceFolder();
});

handleIPC('workspace-set', async (_event, folderPath: string) => {
  validateFilePath(folderPath);
  await workspaceService.setWorkspaceFolder(folderPath);
});

handleIPC('workspace-get', async () => {
  return workspaceService.getWorkspaceFolder();
});

handleIPC('workspace-get-tree', async (_event, dirPath: string) => {
  validateFilePath(dirPath);
  return await workspaceService.getDirectoryTree(dirPath);
});

handleIPC('file-read', async (_event, filePath: string) => {
  validateFilePath(filePath);
  return await fileSystemService.readFile(filePath);
});

handleIPC('file-write', async (_event, filePath: string, content: string) => {
  validateFilePath(filePath);
  await fileSystemService.writeFile(filePath, content);
});

handleIPC('file-create', async (_event, filePath: string, content?: string) => {
  validateFilePath(filePath);
  await fileSystemService.createFile(filePath, content || '');
});

handleIPC('file-delete', async (_event, filePath: string) => {
  validateFilePath(filePath);
  await fileSystemService.deleteFile(filePath);
});

handleIPC('file-rename', async (_event, oldPath: string, newPath: string) => {
  validateFilePath(oldPath);
  validateFilePath(newPath);
  await fileSystemService.renameFile(oldPath, newPath);
});

handleIPC('folder-create', async (_event, folderPath: string) => {
  validateFilePath(folderPath);
  await fileSystemService.createFolder(folderPath);
});

handleIPC('folder-delete', async (_event, folderPath: string) => {
  validateFilePath(folderPath);
  await fileSystemService.deleteFolder(folderPath);
});

handleIPC('folder-rename', async (_event, oldPath: string, newPath: string) => {
  validateFilePath(oldPath);
  validateFilePath(newPath);
  await fileSystemService.renameFolder(oldPath, newPath);
});

handleIPC('folder-list', async (_event, dirPath: string) => {
  validateFilePath(dirPath);
  return await fileSystemService.listDirectory(dirPath);
});

handleIPC('file-search', async (_event, query: string, options: SearchOptions) => {
  return await workspaceService.searchFiles(query, options);
});

handleIPC('file-save-dialog', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save SQL File',
    defaultPath: 'query.sql',
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePath;
});

handleIPC('recent-files-add', async (_event, filePath: string) => {
  validateFilePath(filePath);
  workspaceService.addRecentFile(filePath);
});

handleIPC('recent-files-get', async () => {
  return workspaceService.getRecentFiles();
});

// File watching IPC handlers
handleIPC('file-watch', async (_event, filePath: string) => {
  validateFilePath(filePath);
  fileWatcherService.watchFile(filePath);
});

handleIPC('file-unwatch', async (_event, filePath: string) => {
  validateFilePath(filePath);
  fileWatcherService.unwatchFile(filePath);
});

handleIPC('folder-watch', async (_event, folderPath: string) => {
  validateFilePath(folderPath);
  fileWatcherService.watchFolder(folderPath);
});

handleIPC('folder-unwatch', async (_event, folderPath: string) => {
  validateFilePath(folderPath);
  fileWatcherService.unwatchFolder(folderPath);
});

// Secure connection storage IPC handlers
handleIPC('connections-load-list', async () => {
  const connections = await connectionStorage.loadConnections();
  // Return only safe fields for display (no passwords/credentials)
  return connections.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.config.type,
  }));
});

handleIPC('connections-save', async (_event, connection: any) => {
  await connectionStorage.saveConnection(connection);
});

handleIPC('connections-delete', async (_event, id: string) => {
  await connectionStorage.deleteConnection(id);
});

handleIPC('connections-get', async (_event, id: string) => {
  return await connectionStorage.getConnection(id);
});

handleIPC('connections-connect', async (_event, id: string) => {
  const connection = await connectionStorage.getConnection(id);
  if (!connection) {
    throw new Error('Connection not found');
  }

  if (connection.config.type === 'bigquery') {
    connector = new BigQueryConnector();
    await connector.connect(connection.config);
  } else {
    throw new Error(`Unsupported database type: ${connection.config.type}`);
  }

  return connection;
});
