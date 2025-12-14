// ABOUTME: Electron main process that manages the application window and IPC handlers.
// ABOUTME: Handles database connections and query execution in the Node.js environment.

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import type { ConnectionConfig, QueryResult, DatabaseConnector, SearchOptions } from '../shared/types';
import { BigQueryConnector } from './connectors/bigquery';
import { FileSystemService } from './services/FileSystemService';
import { WorkspaceService } from './services/WorkspaceService';
import { FileWatcherService } from './services/FileWatcherService';

let mainWindow: BrowserWindow | null = null;
let connector: DatabaseConnector | null = null;

// File system services
const fileSystemService = new FileSystemService();
const workspaceService = new WorkspaceService(fileSystemService);
const fileWatcherService = new FileWatcherService();

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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Helper to wrap IPC handlers with error logging
function handleIPC<T extends (...args: any[]) => any>(
  channel: string,
  handler: T
): void {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`IPC handler '${channel}' failed:`, err);
      throw err; // Re-throw for client
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
  await workspaceService.setWorkspaceFolder(folderPath);
});

handleIPC('workspace-get', async () => {
  return workspaceService.getWorkspaceFolder();
});

handleIPC('workspace-get-tree', async (_event, dirPath: string) => {
  return await workspaceService.getDirectoryTree(dirPath);
});

handleIPC('file-read', async (_event, filePath: string) => {
  return await fileSystemService.readFile(filePath);
});

handleIPC('file-write', async (_event, filePath: string, content: string) => {
  await fileSystemService.writeFile(filePath, content);
});

handleIPC('file-create', async (_event, filePath: string, content?: string) => {
  await fileSystemService.createFile(filePath, content || '');
});

handleIPC('file-delete', async (_event, filePath: string) => {
  await fileSystemService.deleteFile(filePath);
});

handleIPC('file-rename', async (_event, oldPath: string, newPath: string) => {
  await fileSystemService.renameFile(oldPath, newPath);
});

handleIPC('folder-create', async (_event, folderPath: string) => {
  await fileSystemService.createFolder(folderPath);
});

handleIPC('folder-delete', async (_event, folderPath: string) => {
  await fileSystemService.deleteFolder(folderPath);
});

handleIPC('folder-rename', async (_event, oldPath: string, newPath: string) => {
  await fileSystemService.renameFolder(oldPath, newPath);
});

handleIPC('folder-list', async (_event, dirPath: string) => {
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
  workspaceService.addRecentFile(filePath);
});

handleIPC('recent-files-get', async () => {
  return workspaceService.getRecentFiles();
});

// File watching IPC handlers
handleIPC('file-watch', async (_event, filePath: string) => {
  await fileWatcherService.watchFile(filePath);
});

handleIPC('file-unwatch', async (_event, filePath: string) => {
  fileWatcherService.unwatchFile(filePath);
});
