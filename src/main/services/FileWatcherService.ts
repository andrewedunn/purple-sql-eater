// ABOUTME: File watching service that detects external changes to open files and folders.
// ABOUTME: Uses chokidar to watch files/folders and send IPC notifications when changes are detected.

import { BrowserWindow } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private folderWatchers: Map<string, FSWatcher> = new Map();
  private window: BrowserWindow | null = null;

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  watchFile(filePath: string): void {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('change', () => {
      if (this.window) {
        this.window.webContents.send('file-changed', filePath);
      }
    });

    watcher.on('unlink', () => {
      if (this.window) {
        this.window.webContents.send('file-deleted', filePath);
      }
      this.unwatchFile(filePath);
    });

    this.watchers.set(filePath, watcher);
  }

  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  watchFolder(folderPath: string): void {
    if (this.folderWatchers.has(folderPath)) {
      return; // Already watching
    }

    const watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 10, // Watch nested folders
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    // Debounce folder changes to avoid rapid-fire updates
    let debounceTimer: NodeJS.Timeout | null = null;
    const notifyChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (this.window) {
          this.window.webContents.send('folder-changed', folderPath);
        }
      }, 300);
    };

    watcher.on('add', notifyChange);
    watcher.on('unlink', notifyChange);
    watcher.on('addDir', notifyChange);
    watcher.on('unlinkDir', notifyChange);

    this.folderWatchers.set(folderPath, watcher);
  }

  unwatchFolder(folderPath: string): void {
    const watcher = this.folderWatchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.folderWatchers.delete(folderPath);
    }
  }

  unwatchAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    for (const watcher of this.folderWatchers.values()) {
      watcher.close();
    }
    this.folderWatchers.clear();
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  getWatchedFolders(): string[] {
    return Array.from(this.folderWatchers.keys());
  }
}
