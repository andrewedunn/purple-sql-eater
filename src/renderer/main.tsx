// ABOUTME: Entry point for the React renderer application.
// ABOUTME: Initializes React and mounts the root component.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
