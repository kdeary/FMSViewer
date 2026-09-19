import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
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
  plugins: [react(), serviceWorker()],
  server: { open: true },
  worker: { format: 'es' },
});
