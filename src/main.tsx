import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
// 8-bit retro font for HUD numbers + hero titles. Latin-only — falls back to
// system font for any CJK character so 「南極大冒險」 stays readable.
import '@fontsource/press-start-2p/400.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
