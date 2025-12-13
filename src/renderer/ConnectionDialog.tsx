// ABOUTME: Connection dialog component for configuring database connections.
// ABOUTME: Currently supports BigQuery with project ID and credentials input.

import { useState } from 'react';
import type { ConnectionConfig } from '../shared/types';

export interface ConnectionDialogResult {
  name: string;
  config: ConnectionConfig;
  saveConnection: boolean;
}

interface ConnectionDialogProps {
  onConnect: (result: ConnectionDialogResult) => void;
  onCancel: () => void;
  externalError?: string | null;
}

export function ConnectionDialog({ onConnect, onCancel, externalError }: ConnectionDialogProps) {
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [credentialsJson, setCredentialsJson] = useState('');
  const [saveConnection, setSaveConnection] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayError = externalError || error;

  const handleConnect = () => {
    setError(null);

    if (saveConnection && !name.trim()) {
      setError('Connection name is required when saving');
      return;
    }

    if (!projectId.trim()) {
      setError('Project ID is required');
      return;
    }

    if (!credentialsJson.trim()) {
      setError('Credentials JSON is required');
      return;
    }

    try {
      const credentials = JSON.parse(credentialsJson);
      const config: ConnectionConfig = {
        type: 'bigquery',
        projectId: projectId.trim(),
        credentials,
      };
      onConnect({
        name: name.trim() || projectId.trim(),
        config,
        saveConnection,
      });
    } catch (err) {
      setError('Invalid JSON format for credentials');
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Connect to BigQuery</h2>

        {displayError && <div className="error">{displayError}</div>}

        <div className="form-group">
          <label htmlFor="name">Connection Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production BigQuery"
            disabled={!saveConnection}
          />
        </div>

        <div className="form-group">
          <label htmlFor="projectId">Project ID</label>
          <input
            id="projectId"
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="my-gcp-project"
          />
        </div>

        <div className="form-group">
          <label htmlFor="credentials">Service Account Credentials (JSON)</label>
          <textarea
            id="credentials"
            value={credentialsJson}
            onChange={(e) => setCredentialsJson(e.target.value)}
            placeholder='{"type": "service_account", "project_id": "...", ...}'
            rows={10}
          />
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={saveConnection}
              onChange={(e) => setSaveConnection(e.target.checked)}
            />
            <span>Save this connection for future use</span>
          </label>
        </div>

        <div className="dialog-buttons">
          <button onClick={handleConnect} className="primary">
            Connect
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
