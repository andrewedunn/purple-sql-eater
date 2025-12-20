// ABOUTME: Preload script that exposes safe IPC methods to the renderer process.
// ABOUTME: Acts as a security bridge between Electron main and renderer processes.

import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionConfig, QueryResult, Schema, Column, FileNode, FileTree, SearchOptions, FileSearchResult } from '../shared/types';

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

  // File system operations
  workspaceSelect: (): Promise<string | null> =>
    ipcRenderer.invoke('workspace-select'),

  workspaceSet: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('workspace-set', folderPath),

  workspaceGet: (): Promise<string | null> =>
    ipcRenderer.invoke('workspace-get'),

  workspaceGetTree: (dirPath: string): Promise<FileTree> =>
    ipcRenderer.invoke('workspace-get-tree', dirPath),

  fileRead: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('file-read', filePath),

  fileWrite: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('file-write', filePath, content),

  fileCreate: (filePath: string, content?: string): Promise<void> =>
    ipcRenderer.invoke('file-create', filePath, content),

  fileDelete: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('file-delete', filePath),

  fileRename: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('file-rename', oldPath, newPath),

  folderCreate: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('folder-create', folderPath),

  folderDelete: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('folder-delete', folderPath),

  folderRename: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('folder-rename', oldPath, newPath),

  folderList: (dirPath: string): Promise<FileNode[]> =>
    ipcRenderer.invoke('folder-list', dirPath),

  fileSearch: (query: string, options: SearchOptions): Promise<FileSearchResult[]> =>
    ipcRenderer.invoke('file-search', query, options),

  fileSaveDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('file-save-dialog'),

  recentFilesAdd: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('recent-files-add', filePath),

  recentFilesGet: (): Promise<string[]> =>
    ipcRenderer.invoke('recent-files-get'),

  fileWatch: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('file-watch', filePath),

  fileUnwatch: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('file-unwatch', filePath),

  folderWatch: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('folder-watch', folderPath),

  folderUnwatch: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('folder-unwatch', folderPath),

  // Secure connection storage operations
  connectionsLoadList: (): Promise<Array<{ id: string; name: string; type: string }>> =>
    ipcRenderer.invoke('connections-load-list'),

  connectionsSave: (connection: any): Promise<void> =>
    ipcRenderer.invoke('connections-save', connection),

  connectionsDelete: (id: string): Promise<void> =>
    ipcRenderer.invoke('connections-delete', id),

  connectionsGet: (id: string): Promise<any> =>
    ipcRenderer.invoke('connections-get', id),

  connectionsConnect: (id: string): Promise<any> =>
    ipcRenderer.invoke('connections-connect', id),

  ipcRenderer: {
    on: (channel: string, func: (...args: any[]) => void) => {
      const allowedChannels = [
        'file-changed',
        'file-deleted',
        'file-renamed',
        'folder-changed',
        'schema-progress',
        'menu-command',
      ];
      if (allowedChannels.includes(channel)) {
        ipcRenderer.on(channel, func);
      }
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
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

      // File system operations
      workspaceSelect: () => Promise<string | null>;
      workspaceSet: (folderPath: string) => Promise<void>;
      workspaceGet: () => Promise<string | null>;
      workspaceGetTree: (dirPath: string) => Promise<FileTree>;
      fileRead: (filePath: string) => Promise<string>;
      fileWrite: (filePath: string, content: string) => Promise<void>;
      fileCreate: (filePath: string, content?: string) => Promise<void>;
      fileDelete: (filePath: string) => Promise<void>;
      fileRename: (oldPath: string, newPath: string) => Promise<void>;
      folderCreate: (folderPath: string) => Promise<void>;
      folderDelete: (folderPath: string) => Promise<void>;
      folderRename: (oldPath: string, newPath: string) => Promise<void>;
      folderList: (dirPath: string) => Promise<FileNode[]>;
      fileSearch: (query: string, options: SearchOptions) => Promise<FileSearchResult[]>;
      fileSaveDialog: () => Promise<string | null>;
      recentFilesAdd: (filePath: string) => Promise<void>;
      recentFilesGet: () => Promise<string[]>;
      fileWatch: (filePath: string) => Promise<void>;
      fileUnwatch: (filePath: string) => Promise<void>;

      // Secure connection storage operations
      connectionsLoadList: () => Promise<Array<{ id: string; name: string; type: string }>>;
      connectionsSave: (connection: any) => Promise<void>;
      connectionsDelete: (id: string) => Promise<void>;
      connectionsGet: (id: string) => Promise<any>;
      connectionsConnect: (id: string) => Promise<any>;

      ipcRenderer?: {
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
      };
    };
  }
}
