import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Writes sw.js from src/pwa/sw.js, listing every file of this build for the
// service worker to precache, and versioned by their names, the page and the
// worker itself, so each deploy gets a fresh cache and the old one is dropped.
function serviceWorker() {
  return {
    name: 'fmsviewer-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const skip = /\.map$|^og-image\.png$|^sw\.js$/;
      const files = [...Object.keys(bundle), ...readdirSync('public')]
        .filter((f) => !skip.test(f))
        .sort();
      const page = bundle['index.html']?.source || '';
      const template = readFileSync('src/pwa/sw.js', 'utf8');
      const version = createHash('sha256').update(files.join('\n')).update(page).update(template)
        .digest('hex').slice(0, 12);
      const source = template
        .replace('__VERSION__', version)
        .replace('self.__PRECACHE__', JSON.stringify(files.map((f) => `./${f}`)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// GitHub Pages has no SPA fallback: a reload of /FMSViewer/view would get
// its stock 404. Pages serves 404.html for any missing path, so that is the
// app itself, and routing.js takes it from there. Its asset paths are
// relative (base './'), which from /FMSViewer/view still resolve to
// /FMSViewer/assets/.
function spaFallback() {
  return {
    name: 'fmsviewer-spa-fallback',
    apply: 'build',
    // After writing: the page isn't in the bundle yet when plugins see it.
    writeBundle(options) {
      copyFileSync(join(options.dir, 'index.html'), join(options.dir, '404.html'));
    },
  };
}

// Shown in the status bar so anyone can tell which build they are running.
// The build time makes every build distinct, which in turn gives every build
// its own service-worker version (the version hashes the emitted files).
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const builtAt = `${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`;

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(builtAt),
  },
  plugins: [react(), serviceWorker(), spaFallback()],
  server: { open: true },
  worker: { format: 'es' },
});
