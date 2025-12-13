// ABOUTME: Preload script that exposes safe IPC methods to the renderer process.
// ABOUTME: Acts as a security bridge between Electron main and renderer processes.

import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionConfig, QueryResult } from '../shared/types';

contextBridge.exposeInMainWorld('electron', {
  executeQuery: (sql: string): Promise<QueryResult> =>
    ipcRenderer.invoke('execute-query', sql),

  connect: (config: ConnectionConfig): Promise<void> =>
    ipcRenderer.invoke('connect', config),

  disconnect: (): Promise<void> =>
    ipcRenderer.invoke('disconnect'),
});

declare global {
  interface Window {
    electron: {
      executeQuery: (sql: string) => Promise<QueryResult>;
      connect: (config: ConnectionConfig) => Promise<void>;
      disconnect: () => Promise<void>;
    };
  }
}
