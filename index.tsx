import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const enablePWA = import.meta && import.meta.env && import.meta.env.VITE_ENABLE_PWA === 'true';
  if (enablePWA) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
  }
}
