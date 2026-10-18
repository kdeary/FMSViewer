import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
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

// The portable build (`--mode portable`): the whole app as one HTML file
// that runs from a double-click, off a USB stick or a shared drive, with no
// server and no network. Browsers won't load module scripts, workers or
// fetches from file:// URLs, so nothing can be a separate file: images, fonts
// and the default Supplement Table are inlined as data: URLs (assetsInlineLimit), the lazy
// chunks folded into the main one (inlineDynamicImports), the parse worker
// inlined as a blob (below), and the script and styles written into the page.
function portable() {
  const outName = 'FMSViewer.html';
  return {
    name: 'fmsviewer-portable',
    apply: 'build',
    enforce: 'pre',

    // `?worker` builds the worker as its own file; `?worker&inline` embeds it.
    async resolveId(source, importer) {
      if (!source.endsWith('?worker')) return null;
      const resolved = await this.resolve(source.slice(0, -'?worker'.length), importer, { skipSelf: true });
      return resolved && `${resolved.id}?worker&inline`;
    },

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // No server to serve these from. The icon goes in as a data: URL; the
        // manifest only matters for installing, which needs a server anyway.
        const icon = readFileSync('public/favicon.png').toString('base64');
        return html
          .replace(/<link rel="manifest"[^>]*>\s*/, '')
          .replace(/href="\.\/favicon\.png"/g, `href="data:image/png;base64,${icon}"`);
      },
    },

    // After Vite has written the page and its script and stylesheet tags.
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const take = (ref) => {
          const name = posix.normalize(ref.replace(/^\.\//, ''));
          const file = bundle[name];
          if (!file) this.error(`portable: ${ref} is not in the bundle`);
          delete bundle[name];
          return file.type === 'chunk' ? file.code : String(file.source);
        };
        // A literal "</script" or "</style" would end the inline element early.
        const html = String(bundle['index.html'].source)
          .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, ref) =>
            `<script type="module">${take(ref).replace(/<\/(script)/gi, '<\\/$1')}</script>`)
          .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_m, ref) =>
            `<style>${take(ref).replace(/<\/(style)/gi, '<\\/$1')}</style>`);
        delete bundle['index.html'];
        this.emitFile({ type: 'asset', fileName: outName, source: html });

        const left = Object.keys(bundle).filter((f) => f !== outName && !f.endsWith('.map'));
        if (left.length) this.error(`portable: not inlined, would be missing offline: ${left.join(', ')}`);
      },
    },
  };
}

// Shown in the status bar so anyone can tell which build they are running.
// The build time makes every build distinct, which in turn gives every build
// its own service-worker version (the version hashes the emitted files).
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const builtAt = `${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`;

export default defineConfig(({ mode }) => {
  const isPortable = mode === 'portable';
  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TIME__: JSON.stringify(builtAt),
      __PORTABLE__: JSON.stringify(isPortable),
    },
    plugins: isPortable ? [react(), portable()] : [react(), serviceWorker(), spaFallback()],
    server: { open: true },
    // A classic worker: unlike a module worker, it can run from a blob or
    // data: URL in every browser, which is what the portable build needs.
    worker: { format: isPortable ? 'iife' : 'es' },
    ...(isPortable && {
      publicDir: false,
      build: {
        outDir: 'dist-portable',
        assetsInlineLimit: () => true,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    }),
  };
});
