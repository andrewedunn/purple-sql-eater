// ABOUTME: Entry point for the React renderer application.
// ABOUTME: Initializes React and mounts the root component.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App-new';
import './design-system.css';
import './App-new.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
