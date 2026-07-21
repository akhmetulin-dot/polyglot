import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

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
