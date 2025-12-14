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

ipcMain.handle('connect', async (_event, config: ConnectionConfig) => {
  if (config.type === 'bigquery') {
    connector = new BigQueryConnector();
    await connector.connect(config);
  } else {
    throw new Error(`Unsupported database type: ${config.type}`);
  }
});

ipcMain.handle('disconnect', async () => {
  if (connector) {
    await connector.disconnect();
    connector = null;
  }
});

ipcMain.handle('execute-query', async (_event, sql: string): Promise<QueryResult> => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }
  return await connector.query(sql);
});

ipcMain.handle('get-schema', async (event) => {
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

ipcMain.handle('get-columns', async (_event, tableName: string) => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }
  return await connector.getColumns(tableName);
});

// File system IPC handlers
ipcMain.handle('workspace-select', async () => {
  return await workspaceService.selectWorkspaceFolder();
});

ipcMain.handle('workspace-set', async (_event, folderPath: string) => {
  await workspaceService.setWorkspaceFolder(folderPath);
});

ipcMain.handle('workspace-get', async () => {
  return workspaceService.getWorkspaceFolder();
});

ipcMain.handle('workspace-get-tree', async (_event, dirPath: string) => {
  return await workspaceService.getDirectoryTree(dirPath);
});

ipcMain.handle('file-read', async (_event, filePath: string) => {
  return await fileSystemService.readFile(filePath);
});

ipcMain.handle('file-write', async (_event, filePath: string, content: string) => {
  await fileSystemService.writeFile(filePath, content);
});

ipcMain.handle('file-create', async (_event, filePath: string, content?: string) => {
  await fileSystemService.createFile(filePath, content || '');
});

ipcMain.handle('file-delete', async (_event, filePath: string) => {
  await fileSystemService.deleteFile(filePath);
});

ipcMain.handle('file-rename', async (_event, oldPath: string, newPath: string) => {
  await fileSystemService.renameFile(oldPath, newPath);
});

ipcMain.handle('folder-create', async (_event, folderPath: string) => {
  await fileSystemService.createFolder(folderPath);
});

ipcMain.handle('folder-delete', async (_event, folderPath: string) => {
  await fileSystemService.deleteFolder(folderPath);
});

ipcMain.handle('folder-rename', async (_event, oldPath: string, newPath: string) => {
  await fileSystemService.renameFolder(oldPath, newPath);
});

ipcMain.handle('folder-list', async (_event, dirPath: string) => {
  return await fileSystemService.listDirectory(dirPath);
});

ipcMain.handle('file-search', async (_event, query: string, options: SearchOptions) => {
  return await workspaceService.searchFiles(query, options);
});

ipcMain.handle('file-save-dialog', async () => {
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

ipcMain.handle('recent-files-add', async (_event, filePath: string) => {
  workspaceService.addRecentFile(filePath);
});

ipcMain.handle('recent-files-get', async () => {
  return workspaceService.getRecentFiles();
});

// File watching IPC handlers
ipcMain.handle('file-watch', async (_event, filePath: string) => {
  await fileWatcherService.watchFile(filePath);
});

ipcMain.handle('file-unwatch', async (_event, filePath: string) => {
  fileWatcherService.unwatchFile(filePath);
});
