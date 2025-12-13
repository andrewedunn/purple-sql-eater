// ABOUTME: Connection dialog component for configuring database connections.
// ABOUTME: Currently supports BigQuery with project ID and credentials input.

import { useState } from 'react';
import type { ConnectionConfig } from '../shared/types';

interface ConnectionDialogProps {
  onConnect: (config: ConnectionConfig) => void;
  onCancel: () => void;
  externalError?: string | null;
}

export function ConnectionDialog({ onConnect, onCancel, externalError }: ConnectionDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [credentialsJson, setCredentialsJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const displayError = externalError || error;

  const handleConnect = () => {
    setError(null);

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
      onConnect(config);
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
