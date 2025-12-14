// ABOUTME: Secure storage for database connection credentials using Electron's safeStorage API.
// ABOUTME: Encrypts sensitive fields like passwords and stores connections in userData directory.

import { app, safeStorage } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ConnectionConfig, BigQueryConnectionConfig } from '../../shared/types';

export interface SavedConnection {
  id: string;
  name: string;
  config: ConnectionConfig;
}

interface EncryptedConnection {
  id: string;
  name: string;
  config: any; // Will contain encrypted fields as base64 strings
}

export class SecureConnectionStorage {
  private connectionsPath: string;

  constructor() {
    this.connectionsPath = path.join(app.getPath('userData'), 'connections.json');
  }

  private encryptString(value: string): string {
    const buffer = safeStorage.encryptString(value);
    return buffer.toString('base64');
  }

  private decryptString(encrypted: string): string {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  }

  private encryptConnection(connection: SavedConnection): EncryptedConnection {
    const config: any = { ...connection.config };

    // Encrypt sensitive fields based on connection type
    if (config.type === 'mysql' || config.type === 'postgresql') {
      config.password = this.encryptString(config.password);
    } else if (config.type === 'snowflake') {
      config.password = this.encryptString(config.password);
    } else if (config.type === 'bigquery') {
      const bqConfig = config as BigQueryConnectionConfig;
      if (bqConfig.credentials) {
        // Encrypt the entire credentials object
        config.credentials = {
          __encrypted: this.encryptString(JSON.stringify(bqConfig.credentials)),
        };
      }
    }

    return {
      id: connection.id,
      name: connection.name,
      config,
    };
  }

  private decryptConnection(encrypted: EncryptedConnection): SavedConnection {
    const config = { ...encrypted.config };

    // Decrypt sensitive fields based on connection type
    try {
      if (config.type === 'mysql' || config.type === 'postgresql') {
        config.password = this.decryptString(config.password);
      } else if (config.type === 'snowflake') {
        config.password = this.decryptString(config.password);
      } else if (config.type === 'bigquery') {
        if (config.credentials && config.credentials.__encrypted) {
          const decrypted = this.decryptString(config.credentials.__encrypted);
          config.credentials = JSON.parse(decrypted);
        }
      }
    } catch (err) {
      console.error('Failed to decrypt connection:', err);
      throw new Error('Failed to decrypt connection credentials. The encryption key may have changed.');
    }

    return {
      id: encrypted.id,
      name: encrypted.name,
      config,
    };
  }

  async loadConnections(): Promise<SavedConnection[]> {
    try {
      const data = await fs.readFile(this.connectionsPath, 'utf-8');
      const encrypted: EncryptedConnection[] = JSON.parse(data);
      return encrypted.map(conn => this.decryptConnection(conn));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // No connections file yet
        return [];
      }
      throw new Error(`Failed to load connections: ${err.message}`);
    }
  }

  async saveConnection(connection: SavedConnection): Promise<void> {
    const connections = await this.loadConnections();

    const existingIndex = connections.findIndex(c => c.id === connection.id);
    if (existingIndex >= 0) {
      connections[existingIndex] = connection;
    } else {
      connections.push(connection);
    }

    await this.saveAllConnections(connections);
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = await this.loadConnections();
    const filtered = connections.filter(c => c.id !== id);
    await this.saveAllConnections(filtered);
  }

  async getConnection(id: string): Promise<SavedConnection | null> {
    const connections = await this.loadConnections();
    return connections.find(c => c.id === id) || null;
  }

  private async saveAllConnections(connections: SavedConnection[]): Promise<void> {
    const encrypted = connections.map(conn => this.encryptConnection(conn));
    await fs.writeFile(
      this.connectionsPath,
      JSON.stringify(encrypted, null, 2),
      'utf-8'
    );
  }
}
