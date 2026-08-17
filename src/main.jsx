import React from 'react';
import { createRoot } from 'react-dom/client';
import './vendor/bootstrap.bundle.min.js';
import App from './App.jsx';
import './styles/app.css';
import USG, { describeToSvg, parse, renderSymbol } from './vendor/usg.min.js';

// Attach global debugging helpers for browser console inspection
if (typeof window !== 'undefined') {
  window.USG = USG || window.USG;
  window.parseUnitTitle = (title) => (parse || USG?.parse)?.(title);
  window.renderUnitModel = (model, opts) => (renderSymbol || USG?.renderSymbol)?.(model, opts);

  window.getUnitSymbolSvg = (title, options) => {
    const fn = describeToSvg || USG?.describeToSvg;
    if (!fn) return 'USG describeToSvg not loaded';
    return fn(title, options);
  };

  window.getUnitSymbolDataUri = (title, options) => {
    const svg = window.getUnitSymbolSvg(title, options);
    if (!svg || typeof svg !== 'string' || !svg.includes('<svg')) return svg;
    const cleaned = svg
      .replace(/clip-path="url\(#usg-frame\)"/g, 'clip-path="url(#usg-debug)"')
      .replace(/clipPath id="usg-frame"/g, 'clipPath id="usg-debug"')
      .replace(/style="color:#000"/g, '');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
  };
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
