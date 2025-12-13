// ABOUTME: Electron main process that manages the application window and IPC handlers.
// ABOUTME: Handles database connections and query execution in the Node.js environment.

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import type { ConnectionConfig, QueryResult } from '../shared/types';
import { BigQueryConnector } from './connectors/bigquery';

let mainWindow: BrowserWindow | null = null;
let connector: BigQueryConnector | null = null;

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
    mainWindow = null;
  });
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

ipcMain.handle('get-schema', async () => {
  if (!connector) {
    throw new Error('Not connected to a database');
  }
  return await connector.getSchema();
});
