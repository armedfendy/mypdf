/**
 * mypdf.id — audit teks berbahasa Inggris yang masih terlihat di hasil build.
 *
 * Pemakaian (setelah `npm run build:mypdf`):
 *   node scripts/mypdf-i18n-audit.mjs                 ringkasan semua halaman
 *   node scripts/mypdf-i18n-audit.mjs merge-pdf       daftar teks satu halaman
 *   node scripts/mypdf-i18n-audit.mjs --json > x.json semua teks, format JSON
 *
 * Deteksi memakai heuristik kata umum bahasa Inggris vs Indonesia, jadi
 * hasilnya perkiraan, bukan kepastian.
 */
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');

const EN = new Set(
  'the and to of your is are for with you this from will can in on it be or as by that not into an all each use what how why when which does do only than'.split(
    ' '
  )
);
const ID = new Set(
  'yang dan di ke untuk dengan anda ini dari tidak atau dalam pada bisa akan juga setiap semua halaman file berkas'.split(
    ' '
  )
);

function isEnglish(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length < 2) return false;
  let en = 0;
  let id = 0;
  for (const w of words) {
    if (EN.has(w)) en++;
    if (ID.has(w)) id++;
  }
  return en >= 1 && en > id;
}

function englishTexts(html) {
  const dom = new JSDOM(html);
  const { document, NodeFilter } = dom.window;
  document
    .querySelectorAll('script, style, noscript, template, nav, footer')
    .forEach((el) => el.remove());
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (t && isEnglish(t)) out.push(t);
  }
  dom.window.close();
  return out;
}

const arg = process.argv[2];
const files = fs
  .readdirSync(DIST_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

if (arg && arg !== '--json') {
  const f = path.join(DIST_DIR, `${arg.replace(/\.html$/, '')}.html`);
  for (const t of englishTexts(fs.readFileSync(f, 'utf-8'))) console.log(t);
  process.exit(0);
}

const report = {};
for (const f of files) {
  report[f.replace(/\.html$/, '')] = englishTexts(
    fs.readFileSync(path.join(DIST_DIR, f), 'utf-8')
  );
}
if (arg === '--json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  const rows = Object.entries(report)
    .map(([k, v]) => [k, v.length])
    .sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0);
  console.log(`Teks berbahasa Inggris: ${total} di ${rows.length} halaman`);
  for (const [k, n] of rows)
    if (n > 0) console.log(`${String(n).padStart(4)}  ${k}`);
}
