// ABOUTME: File watching service that detects external changes to open files.
// ABOUTME: Uses chokidar to watch files and send IPC notifications when changes are detected.

import chokidar, { type FSWatcher } from 'chokidar';
import { BrowserWindow } from 'electron';

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
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

  unwatchAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }
}
