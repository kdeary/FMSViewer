// Renders images/og-image.svg to public/og-image.png (1200×630) with a
// headless Chrome or Edge. Set CHROME_PATH to use a different browser.
//
//   npm run og-image [-- <output.png>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const src = resolve('images/og-image.svg');
const out = resolve(process.argv[2] || 'public/og-image.png');

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

// A throwaway profile, so an open browser window doesn't swallow the run.
const profile = mkdtempSync(join(tmpdir(), 'og-image-'));
try {
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    '--window-size=1200,630',
    `--screenshot=${out}`,
    pathToFileURL(src).href,
  ], { stdio: 'inherit' });
} finally {
  rmSync(profile, { recursive: true, force: true });
}
console.log(`Wrote ${out}`);
