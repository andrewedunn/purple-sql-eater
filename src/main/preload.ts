// ABOUTME: Preload script that exposes safe IPC methods to the renderer process.
// ABOUTME: Acts as a security bridge between Electron main and renderer processes.

import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionConfig, QueryResult, Schema, Column } from '../shared/types';

contextBridge.exposeInMainWorld('electron', {
  executeQuery: (sql: string): Promise<QueryResult> =>
    ipcRenderer.invoke('execute-query', sql),

  connect: (config: ConnectionConfig): Promise<void> =>
    ipcRenderer.invoke('connect', config),

  disconnect: (): Promise<void> =>
    ipcRenderer.invoke('disconnect'),

  getSchema: (): Promise<Schema> =>
    ipcRenderer.invoke('get-schema'),

  getColumns: (tableName: string): Promise<Column[]> =>
    ipcRenderer.invoke('get-columns', tableName),

  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, func);
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
  },
});

declare global {
  interface Window {
    electron: {
      executeQuery: (sql: string) => Promise<QueryResult>;
      connect: (config: ConnectionConfig) => Promise<void>;
      disconnect: () => Promise<void>;
      getSchema: () => Promise<Schema>;
      getColumns: (tableName: string) => Promise<Column[]>;
      ipcRenderer?: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
      };
    };
  }
}
