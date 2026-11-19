import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayPill } from './OverlayPill';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found — check overlay.html');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <OverlayPill />
  </React.StrictMode>
);
