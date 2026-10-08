/**
 * mypdf.id — single-locale post-build step.
 *
 * Aktif hanya bila VITE_LOCK_LANGUAGE di-set (misalnya "id"). Tanpa variabel
 * itu, script ini tidak melakukan apa pun sehingga perilaku build BentoPDF
 * asli tetap sama.
 *
 * Yang dilakukan (dijalankan setelah generate-i18n-pages + generate-sitemap):
 *   1. Halaman hasil terjemahan di dist/<lang>/ dipindah ke root dist/,
 *      menggantikan versi bahasa Inggris. Tautan, canonical, og:url dan
 *      JSON-LD diubah dari /<lang>/... menjadi /...
 *   2. Semua folder bahasa lain (dist/en, dist/ar, ...) dihapus, karena situs
 *      hanya memakai satu bahasa.
 *   3. Tag hreflang dihapus dari HTML dan sitemap.xml.
 *   4. Baris Sitemap di robots.txt diarahkan ke SITE_URL.
 *   5. File terkompresi (.br/.gz) untuk HTML yang diubah dibuat ulang.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const LOCALES_DIR = path.resolve(__dirname, '../public/locales');

const LANG = (process.env.VITE_LOCK_LANGUAGE || '').trim();
const SITE_URL = (process.env.SITE_URL || 'https://www.bentopdf.com').replace(
  /\/+$/,
  ''
);
const BASE_PATH = (process.env.BASE_URL || '/').replace(/\/$/, '');

if (!LANG) {
  console.log('[single-locale] VITE_LOCK_LANGUAGE tidak di-set, dilewati.');
  process.exit(0);
}

const LANG_DIR = path.join(DIST_DIR, LANG);
if (!fs.existsSync(LANG_DIR)) {
  console.error(`[single-locale] dist/${LANG} tidak ditemukan.`);
  process.exit(1);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// https://site/<lang>/x -> https://site/x ; https://site/<lang> -> https://site/
const absLangRe = new RegExp(
  `${escapeRe(SITE_URL)}${escapeRe(BASE_PATH)}/${escapeRe(LANG)}(?=/|$|["'?#\\s])/?`,
  'g'
);
const stripAbs = (value) =>
  value.replace(absLangRe, `${SITE_URL}${BASE_PATH}/`);

// /<lang>/x -> /x ; /<lang> -> /
const relLangRe = new RegExp(
  `^${escapeRe(BASE_PATH)}/${escapeRe(LANG)}(?=/|$|[?#])/?`
);
const stripRel = (href) => href.replace(relLangRe, `${BASE_PATH}/`);

function walkHtml(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) out.push(...walkHtml(full, rel));
    else if (entry.endsWith('.html')) out.push(rel);
  }
  return out;
}

function writeWithCompressed(target, content) {
  fs.writeFileSync(target, content);
  const buf = Buffer.from(content);
  if (fs.existsSync(`${target}.br`)) {
    fs.writeFileSync(
      `${target}.br`,
      zlib.brotliCompressSync(buf, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
      })
    );
  }
  if (fs.existsSync(`${target}.gz`)) {
    fs.writeFileSync(`${target}.gz`, zlib.gzipSync(buf, { level: 9 }));
  }
}

function transform(html) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  document.documentElement.lang = LANG;

  document
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((el) => el.remove());

  for (const sel of [
    'link[rel="canonical"]',
    'meta[property="og:url"]',
    'meta[name="twitter:url"]',
  ]) {
    document.querySelectorAll(sel).forEach((el) => {
      const attr = el.tagName === 'LINK' ? 'href' : 'content';
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, stripAbs(v));
    });
  }

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('/')) a.setAttribute('href', stripRel(href));
    else if (href.startsWith(SITE_URL)) a.setAttribute('href', stripAbs(href));
  });

  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((s) => {
      if (s.textContent) s.textContent = stripAbs(s.textContent);
    });

  const result = dom.serialize();
  dom.window.close();
  return result;
}

console.log(`[single-locale] Bahasa tunggal: ${LANG}, SITE_URL: ${SITE_URL}`);

// 1. Pindahkan halaman dist/<lang>/ ke root
const pages = walkHtml(LANG_DIR);
for (const rel of pages) {
  const html = fs.readFileSync(path.join(LANG_DIR, rel), 'utf-8');
  const target = path.join(DIST_DIR, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeWithCompressed(target, transform(html));
}
console.log(`[single-locale] ${pages.length} halaman dipindah ke root.`);

// 2. Hapus semua folder bahasa
const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => fs.statSync(path.join(LOCALES_DIR, f)).isDirectory());
let removed = 0;
for (const loc of locales) {
  const dir = path.join(DIST_DIR, loc);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    removed++;
  }
}
console.log(`[single-locale] ${removed} folder bahasa dihapus.`);

// 3. Halaman root lain (mis. blog) yang tidak punya versi terjemahan: buang hreflang
for (const rel of walkHtml(DIST_DIR)) {
  if (rel.startsWith('assets/') || rel.startsWith('docs/')) continue;
  if (pages.includes(rel)) continue;
  const full = path.join(DIST_DIR, rel);
  const html = fs.readFileSync(full, 'utf-8');
  if (!/hreflang=/.test(html)) continue;
  writeWithCompressed(
    full,
    html.replace(/\s*<link[^>]+rel=["']alternate["'][^>]*hreflang=[^>]*>/g, '')
  );
}

// 3b. Blog bawaan BentoPDF (tulisan pembuat BentoPDF, berbahasa Inggris) tidak
//     ikut dipublikasikan. Konten panduan mypdf.id menyusul di /panduan/.
const blogDir = path.join(DIST_DIR, 'blog');
if (fs.existsSync(blogDir)) {
  fs.rmSync(blogDir, { recursive: true, force: true });
  console.log('[single-locale] dist/blog dihapus.');
}

// 4. Sitemap tanpa hreflang dan tanpa blog
const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const xml = fs
    .readFileSync(sitemapPath, 'utf-8')
    .replace(/\s*<xhtml:link [^>]*\/>/g, '')
    .replace(
      /\s*<url>\s*<loc>[^<]*\/blog(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g,
      ''
    );
  writeWithCompressed(sitemapPath, xml);
  console.log('[single-locale] sitemap.xml dibersihkan dari hreflang.');
}

// 5. robots.txt
const robotsPath = path.join(DIST_DIR, 'robots.txt');
if (fs.existsSync(robotsPath)) {
  const robots = fs
    .readFileSync(robotsPath, 'utf-8')
    .replace(/^#.*bentopdf.*$/gim, '')
    .replace(/^Sitemap:.*$/m, `Sitemap: ${SITE_URL}${BASE_PATH}/sitemap.xml`)
    .replace(/^\n+/, '');
  writeWithCompressed(robotsPath, robots);
}

console.log('[single-locale] Selesai.');
