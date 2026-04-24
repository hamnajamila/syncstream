import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

console.log('Main.tsx: Application starting...');
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

// Hide the diagnostic check once we start mounting
const check = document.getElementById('html-check');
if (check) check.style.display = 'none';

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
