// ABOUTME: Connection picker and manager for saved database connections.
// ABOUTME: Uses secure storage in main process via IPC for credential encryption.

import { useState, useEffect } from 'react';
import './ConnectionPicker.css';

export interface ConnectionListItem {
  id: string;
  name: string;
  type: string;
}

interface ConnectionPickerProps {
  onConnect: (connectionId: string, connectionName: string) => void;
  onDisconnect: () => void;
  isConnected: boolean;
  currentConnection: ConnectionListItem | null;
  onShowConnectionDialog: () => void;
}

export function ConnectionPicker({
  onConnect,
  onDisconnect,
  isConnected,
  currentConnection,
  onShowConnectionDialog,
}: ConnectionPickerProps) {
  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const conns = await window.electron.connectionsLoadList();
      setConnections(conns);
    } catch (error: any) {
      console.error('Failed to load connections:', error);
      alert(`Failed to load connections: ${error.message}`);
    }
  };

  const handleSelectConnection = async (connection: ConnectionListItem) => {
    try {
      await onConnect(connection.id, connection.name);
      setShowDropdown(false);
    } catch (error: any) {
      console.error('Failed to connect:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleDeleteConnection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this connection?')) {
      try {
        await window.electron.connectionsDelete(id);
        await loadConnections(); // Reload list
        if (currentConnection?.id === id) {
          onDisconnect();
        }
      } catch (error: any) {
        console.error('Failed to delete connection:', error);
        alert(`Failed to delete connection: ${error.message}`);
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
                          {conn.type}
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
