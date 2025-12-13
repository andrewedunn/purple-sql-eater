// ABOUTME: Connection picker and manager for saved database connections.
// ABOUTME: Stores connections in localStorage and provides UI for selection and management.

import { useState, useEffect } from 'react';
import type { ConnectionConfig } from '../../shared/types';
import './ConnectionPicker.css';

export interface SavedConnection {
  id: string;
  name: string;
  config: ConnectionConfig;
}

interface ConnectionPickerProps {
  onConnect: (connection: SavedConnection) => void;
  onDisconnect: () => void;
  isConnected: boolean;
  currentConnection: SavedConnection | null;
  onShowConnectionDialog: () => void;
}

const STORAGE_KEY = 'purple-sql-eater-connections';

export function ConnectionPicker({
  onConnect,
  onDisconnect,
  isConnected,
  currentConnection,
  onShowConnectionDialog,
}: ConnectionPickerProps) {
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConnections(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    }
  };

  const saveConnections = (conns: SavedConnection[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
      setConnections(conns);
    } catch (error) {
      console.error('Failed to save connections:', error);
    }
  };

  const handleSelectConnection = (connection: SavedConnection) => {
    onConnect(connection);
    setShowDropdown(false);
  };

  const handleDeleteConnection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this connection?')) {
      const updated = connections.filter((c) => c.id !== id);
      saveConnections(updated);
      if (currentConnection?.id === id) {
        onDisconnect();
      }
    }
  };

  return (
    <div className="connection-picker">
      {isConnected && currentConnection ? (
        <div className="connection-current">
          <div className="connection-status connected">
            <span className="status-dot"></span>
            <span className="status-text">{currentConnection.name}</span>
          </div>
          <button
            className="btn-disconnect"
            onClick={onDisconnect}
            title="Disconnect"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="connection-selector">
          <button
            className="btn-select-connection"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className="status-dot disconnected"></span>
            <span>Select Connection</span>
            <span className="dropdown-arrow">▼</span>
          </button>

          {showDropdown && (
            <>
              <div
                className="dropdown-backdrop"
                onClick={() => setShowDropdown(false)}
              ></div>
              <div className="connection-dropdown">
                {connections.length > 0 ? (
                  <>
                    {connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="connection-item"
                        onClick={() => handleSelectConnection(conn)}
                      >
                        <span className="connection-name">{conn.name}</span>
                        <span className="connection-type">
                          {conn.config.type}
                        </span>
                        <button
                          className="btn-delete-connection"
                          onClick={(e) => handleDeleteConnection(conn.id, e)}
                          title="Delete connection"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <div className="connection-divider"></div>
                  </>
                ) : (
                  <div className="connection-empty">No saved connections</div>
                )}
                <button
                  className="btn-new-connection"
                  onClick={() => {
                    onShowConnectionDialog();
                    setShowDropdown(false);
                  }}
                >
                  + New Connection
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function saveConnection(connection: SavedConnection) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const connections: SavedConnection[] = stored ? JSON.parse(stored) : [];

    const existingIndex = connections.findIndex((c) => c.id === connection.id);
    if (existingIndex >= 0) {
      connections[existingIndex] = connection;
    } else {
      connections.push(connection);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  } catch (error) {
    console.error('Failed to save connection:', error);
  }
}
