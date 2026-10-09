/**
 * mypdf.id — persiapan deploy ke Cloudflare Pages.
 *
 * Aktif hanya bila MYPDF=true. Dijalankan setelah
 * generate-security-headers.mjs. Yang dilakukan:
 *   1. dist/_headers   : header keamanan (CSP, dll.) dari
 *                        security-headers.conf + aturan cache. COOP/COEP
 *                        hanya di halaman `isolatedPages` (mypdf.config.json).
 *   2. dist/_redirects : redirect URL lama dan prefix bahasa (/id/, /en/).
 *   3. File LibreOffice WASM (> 25 MiB) dikeluarkan dari dist/, karena
 *      Cloudflare Pages menolak file di atas 25 MiB. File tersebut di-host
 *      terpisah (mis. Cloudflare R2) lewat VITE_LIBREOFFICE_DATA_URL.
 *   4. File kompresi bawaan build (*.br, *.gz) dihapus; Cloudflare
 *      mengompres sendiri.
 *   5. Pemeriksaan akhir: build gagal bila masih ada file > 25 MiB atau
 *      jumlah file melebihi batas Cloudflare Pages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

if (process.env.MYPDF !== 'true') {
  console.log('[mypdf-cloudflare] MYPDF tidak di-set, dilewati.');
  process.exit(0);
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20000;
const LO_DATA_URL = (process.env.VITE_LIBREOFFICE_DATA_URL || '').trim();

function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// 1. _headers
const confPath = path.join(ROOT, 'security-headers.conf');
if (!fs.existsSync(confPath)) {
  console.error('[mypdf-cloudflare] security-headers.conf tidak ditemukan.');
  process.exit(1);
}
const loOrigin = LO_DATA_URL ? originOf(LO_DATA_URL) : null;
const mypdfConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'mypdf.config.json'), 'utf-8')
);
// COOP/COEP (cross-origin isolation) hanya dipasang di halaman yang butuh
// SharedArrayBuffer (LibreOffice, wasm-vips). Halaman lain tanpa COEP agar
// iklan Google AdSense bisa tampil (AdSense tidak mendukung halaman ber-COEP).
const ISOLATION_HEADERS = new Set([
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Embedder-Policy',
]);
const isolatedPages = mypdfConfig.isolatedPages || [];
// Proxy CORS bawaan BentoPDF hanya dipakai di domain bentopdf.com; tanpa
// VITE_CORS_PROXY_URL, origin itu tidak perlu ada di CSP mypdf.id.
const BENTO_PROXY = 'https://bentopdf-cors-proxy.bentopdf.workers.dev';
const hasOwnProxy = Boolean((process.env.VITE_CORS_PROXY_URL || '').trim());
const parsedHeaders = fs
  .readFileSync(confPath, 'utf-8')
  .split('\n')
  .map((line) => line.match(/^add_header\s+(\S+)\s+"(.*)"\s+always;$/))
  .filter(Boolean)
  .map(([, name, value]) => {
    if (name === 'Content-Security-Policy') {
      if (loOrigin) {
        value = value.replace(
          /connect-src ([^;]*)/,
          `connect-src $1 ${loOrigin}`
        );
      }
      if (!hasOwnProxy) value = value.split(` ${BENTO_PROXY}`).join('');
    }
    return [name, value];
  });
const securityHeaders = parsedHeaders
  .filter(([name]) => !ISOLATION_HEADERS.has(name))
  .map(([name, value]) => `  ${name}: ${value}`);
const isolationHeaders = parsedHeaders
  .filter(([name]) => ISOLATION_HEADERS.has(name))
  .map(([name, value]) => `  ${name}: ${value}`);
// Worker, WASM, dan iframe yang dimuat halaman ber-COEP juga wajib membawa
// COEP (browser memblokir worker tanpa COEP). Header ini tidak berpengaruh
// pada iklan karena hanya dokumen HTML yang menentukan isolasi halaman.
const staticPaths = fs
  .readdirSync(DIST_DIR, { withFileTypes: true })
  .filter((e) => !e.name.startsWith('_'))
  .filter((e) => e.isDirectory() || !e.name.endsWith('.html'))
  .map((e) => (e.isDirectory() ? `/${e.name}/*` : `/${e.name}`))
  .sort();
// Satu blok per path: Cloudflare tidak menggabungkan dua blok dengan path
// yang sama, jadi header isolasi dan cache disatukan di sini.
const CACHE_IMMUTABLE = 'Cache-Control: public, max-age=31536000, immutable';
const CACHE_REVALIDATE = 'Cache-Control: public, max-age=0, must-revalidate';
const cacheRules = {
  '/assets/*': CACHE_IMMUTABLE,
  '/sw.js': CACHE_REVALIDATE,
  '/workers/*': CACHE_REVALIDATE,
  '/coherentpdf.browser.min.js': CACHE_REVALIDATE,
  '/qpdf.wasm': CACHE_REVALIDATE,
};
const rules = new Map();
const addRule = (p, lines) => rules.set(p, [...(rules.get(p) || []), ...lines]);
isolatedPages.forEach((page) => {
  addRule(`/${page}`, isolationHeaders);
  addRule(`/${page}.html`, isolationHeaders);
});
staticPaths.forEach((p) => addRule(p, isolationHeaders));
Object.entries(cacheRules).forEach(([p, h]) => addRule(p, [`  ${h}`]));

const headers = [
  '# Dibuat otomatis oleh scripts/mypdf-cloudflare.mjs. Jangan diedit manual.',
  '/*',
  ...securityHeaders,
  '',
  ...[...rules].flatMap(([p, lines]) => [p, ...lines, '']),
].join('\n');
fs.writeFileSync(path.join(DIST_DIR, '_headers'), headers);
console.log('[mypdf-cloudflare] dist/_headers ditulis.');

// 2. _redirects
const redirects = [
  '# Dibuat otomatis oleh scripts/mypdf-cloudflare.mjs. Jangan diedit manual.',
  '/id /  301',
  '/id/* /:splat 301',
  '/en /  301',
  '/en/* /:splat 301',
  '/src/pages/:page /:page 301',
  '/tools/:page /:page 301',
  '/change-text-color /text-color 301',
  '/pdf-to-docx /pdf-to-word 301',
  '/decrypt-pdf /unlock-pdf 301',
  '/encrypt-pdf /protect-pdf 301',
  '/blog /  302',
  '/blog/* /  302',
  '',
].join('\n');
fs.writeFileSync(path.join(DIST_DIR, '_redirects'), redirects);
console.log('[mypdf-cloudflare] dist/_redirects ditulis.');

// 3. LibreOffice WASM di luar Cloudflare Pages
for (const name of ['soffice.wasm.gz', 'soffice.data.gz']) {
  const f = path.join(DIST_DIR, 'libreoffice-wasm', name);
  if (fs.existsSync(f)) fs.rmSync(f);
}
if (LO_DATA_URL) {
  console.log(`[mypdf-cloudflare] Data LibreOffice dimuat dari ${LO_DATA_URL}`);
} else {
  console.warn(
    '[mypdf-cloudflare] PERINGATAN: VITE_LIBREOFFICE_DATA_URL kosong. ' +
      'Alat Word/Excel/PowerPoint ke PDF tidak akan berfungsi.'
  );
}

// 4. Hapus file kompresi hasil build (x.br / x.gz yang punya file asli)
let removedCompressed = 0;
for (const f of walk(DIST_DIR)) {
  if (/\.(br|gz)$/.test(f) && fs.existsSync(f.replace(/\.(br|gz)$/, ''))) {
    fs.rmSync(f);
    removedCompressed++;
  }
}
console.log(
  `[mypdf-cloudflare] ${removedCompressed} file .br/.gz hasil build dihapus.`
);

// 5. Pemeriksaan batas Cloudflare Pages
const files = walk(DIST_DIR);
const tooBig = files.filter((f) => fs.statSync(f).size > MAX_FILE_BYTES);
if (tooBig.length > 0) {
  console.error('[mypdf-cloudflare] File melebihi 25 MiB:');
  tooBig.forEach((f) => console.error(`  - ${path.relative(DIST_DIR, f)}`));
  process.exit(1);
}
if (files.length > MAX_FILES) {
  console.error(
    `[mypdf-cloudflare] Jumlah file ${files.length} melebihi batas ${MAX_FILES}.`
  );
  process.exit(1);
}
console.log(
  `[mypdf-cloudflare] OK: ${files.length} file, semuanya di bawah 25 MiB.`
);
