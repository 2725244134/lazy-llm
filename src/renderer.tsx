import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import './styles/globals.css';
import './styles/app.css';
import './styles/sidebar.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Missing #app root element');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
