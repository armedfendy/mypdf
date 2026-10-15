#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function originOf(urlStr) {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function originListOf(envVar) {
  return uniq((envVar || '').split(',').map((s) => originOf(s.trim())));
}

const DEFAULT_WASM_ORIGINS = {
  pymupdf: 'https://cdn.jsdelivr.net',
  gs: 'https://cdn.jsdelivr.net',
  cpdf: 'https://cdn.jsdelivr.net',
};
const DEFAULT_CORS_PROXY_ORIGIN =
  'https://bentopdf-cors-proxy.bentopdf.workers.dev';
const DEFAULT_OCR_FONT_CDN_ORIGIN = 'https://rawcdn.githack.com';

const wasmOrigins = [
  originOf(process.env.VITE_WASM_PYMUPDF_URL) || DEFAULT_WASM_ORIGINS.pymupdf,
  originOf(process.env.VITE_WASM_GS_URL) || DEFAULT_WASM_ORIGINS.gs,
  originOf(process.env.VITE_WASM_CPDF_URL) || DEFAULT_WASM_ORIGINS.cpdf,
];

const tesseractOrigins = uniq([
  originOf(process.env.VITE_TESSERACT_WORKER_URL),
  originOf(process.env.VITE_TESSERACT_CORE_URL),
  originOf(process.env.VITE_TESSERACT_LANG_URL),
]);

const corsProxyOrigin =
  originOf(process.env.VITE_CORS_PROXY_URL) || DEFAULT_CORS_PROXY_ORIGIN;

const ocrFontOrigin =
  originOf(process.env.VITE_OCR_FONT_BASE_URL) || DEFAULT_OCR_FONT_CDN_ORIGIN;

// Domain iklan Adsterra. Kosong secara default -- isi lewat env
// VITE_ADSTERRA_*_ORIGINS (daftar origin dipisah koma) setelah kode slot
// asli didapat dari dashboard Adsterra (Fase 1, lihat
// _local/plan/rencana-adsterra.md). Jangan menebak domain Adsterra di sini:
// banyak jaringan iklan memakai domain penyajian yang berbeda-beda per
// akun/zona, bahkan berganti dari waktu ke waktu.
const adsterraScriptOrigins = originListOf(
  process.env.VITE_ADSTERRA_SCRIPT_ORIGINS
);
const adsterraConnectOrigins = originListOf(
  process.env.VITE_ADSTERRA_CONNECT_ORIGINS
);
const adsterraFrameOrigins = originListOf(
  process.env.VITE_ADSTERRA_FRAME_ORIGINS
);

const scriptOrigins = uniq([
  ...wasmOrigins,
  ...tesseractOrigins,
  ...adsterraScriptOrigins,
]);
const connectOrigins = uniq([
  ...wasmOrigins,
  ...tesseractOrigins,
  corsProxyOrigin,
  ocrFontOrigin,
  ...adsterraConnectOrigins,
]);
const fontOrigins = uniq([ocrFontOrigin].filter(Boolean));

// Format Banner Adsterra butuh blok <script> inline untuk atOptions
// (lihat src/js/ads.ts). 'unsafe-inline' di script-src hanya ditambahkan
// saat Adsterra memang dikonfigurasi, supaya CSP tidak melemah bagi yang
// belum memasang iklan.
const adsterraConfigured =
  adsterraScriptOrigins.length > 0 ||
  adsterraConnectOrigins.length > 0 ||
  adsterraFrameOrigins.length > 0;
const scriptSrcUnsafeInline = adsterraConfigured ? " 'unsafe-inline'" : '';

// mypdf.id meng-inline public/theme.js di setiap halaman (scripts/
// mypdf-brand.mjs). Tanpa 'unsafe-inline', skrip itu diizinkan lewat hash.
// Saat 'unsafe-inline' aktif (Adsterra), hash tidak ditambahkan karena
// browser akan mengabaikan 'unsafe-inline' bila ada hash/nonce di script-src.
const themeHashSource =
  process.env.MYPDF === 'true' && !adsterraConfigured
    ? ` 'sha256-${createHash('sha256')
        .update(
          readFileSync(join(repoRoot, 'public', 'theme.js'), 'utf-8').replace(
            /\r\n/g,
            '\n'
          )
        )
        .digest('base64')}'`
    : '';

const githubStarsDisabled =
  process.env.DISABLE_GITHUB_STARS === 'true' ||
  process.env.SIMPLE_MODE === 'true';
const githubApiSource = githubStarsDisabled ? '' : ' https://api.github.com';

const directives = [
  `default-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'${scriptSrcUnsafeInline}${themeHashSource} blob: ${scriptOrigins.join(' ')}`.trim(),
  `worker-src 'self' blob:`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: https://fonts.gstatic.com ${fontOrigins.join(' ')}`.trim(),
  `connect-src 'self' blob:${githubApiSource} https://fonts.gstatic.com ${connectOrigins.join(' ')}`.trim(),
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-src 'self' blob: ${adsterraFrameOrigins.join(' ')}`.trim(),
  `frame-ancestors 'self'`,
  `form-action 'self'`,
];

const docsDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' ${scriptOrigins.join(' ')}`.trim(),
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: https://fonts.gstatic.com ${fontOrigins.join(' ')}`.trim(),
  `connect-src 'self'${githubApiSource} https://fonts.gstatic.com ${connectOrigins.join(' ')}`.trim(),
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'self'`,
  `form-action 'self'`,
];

const csp = directives.join('; ');
const docsCsp = docsDirectives.join('; ');

const commonHeaders = `add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "credentialless" always;
add_header Cross-Origin-Resource-Policy "cross-origin" always;
`;

const contents = `add_header Content-Security-Policy "${csp}" always;
${commonHeaders}`;

const docsContents = `add_header Content-Security-Policy "${docsCsp}" always;
${commonHeaders}`;

const outPath = join(repoRoot, 'security-headers.conf');
const docsOutPath = join(repoRoot, 'security-headers-docs.conf');
writeFileSync(outPath, contents);
writeFileSync(docsOutPath, docsContents);
console.log(
  `[security-headers] wrote ${outPath} with ${scriptOrigins.length} script-src / ${connectOrigins.length} connect-src origin(s)`
);
console.log(`[security-headers] wrote ${docsOutPath} (docs CSP)`);
if (
  adsterraScriptOrigins.length ||
  adsterraConnectOrigins.length ||
  adsterraFrameOrigins.length
) {
  console.log(
    `[security-headers] Adsterra: ${adsterraScriptOrigins.length} script-src / ${adsterraConnectOrigins.length} connect-src / ${adsterraFrameOrigins.length} frame-src origin(s)`
  );
} else {
  console.log(
    '[security-headers] Adsterra: belum ada origin (set VITE_ADSTERRA_SCRIPT_ORIGINS / VITE_ADSTERRA_CONNECT_ORIGINS / VITE_ADSTERRA_FRAME_ORIGINS setelah Fase 1)'
  );
}
