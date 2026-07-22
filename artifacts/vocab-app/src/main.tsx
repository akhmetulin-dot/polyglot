import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// When deployed to Vercel (or any standalone host), set the API base URL
// so all API calls go to the correct backend domain.
// In dev, Vite proxies /api → backend, so no base URL is needed.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(String(apiUrl));
}

createRoot(document.getElementById('root')!).render(<App />);

// Register service worker for PWA (offline support + installability)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL ?? '/';
    navigator.serviceWorker
      .register(`${base}sw.js`)
      .catch(() => {/* SW registration is best-effort */});
  });
}
