/**
 * mypdf.id — subset CSS ikon Phosphor untuk modul yang dimuat di semua halaman.
 *
 * '@phosphor-icons/web/regular' berisi ±1.500 aturan ikon (±58 KiB) di dalam
 * style.css yang memblokir render, dan @font-face-nya memakai
 * font-display: block. Skrip ini memindai semua nama ikon `ph-...` di sumber
 * (HTML, TS termasuk config/tools.ts, konten, skrip build) lalu menulis
 * src/css/phosphor-subset.css berisi aturan dasar `.ph`, @font-face dengan
 * font-display: swap, dan hanya aturan ikon yang dipakai.
 *
 * Halaman yang mengimpor koleksi penuh secara langsung (tools.html, editor
 * workflow, dll.) tidak berubah. Dijalankan di awal `npm run build`; hasilnya
 * ikut di-commit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PKG = path.join(ROOT, 'node_modules', '@phosphor-icons', 'web');
const SRC_CSS = path.join(PKG, 'src', 'regular', 'style.css');
const OUT = path.join(ROOT, 'src', 'css', 'phosphor-subset.css');

const SCAN = [
  { dir: '.', exts: ['.html'], recursive: false },
  { dir: 'src', exts: ['.html', '.ts', '.json'], recursive: true },
  { dir: 'content', exts: ['.html', '.md', '.json'], recursive: true },
  { dir: 'blog', exts: ['.html'], recursive: true },
  { dir: 'panduan', exts: ['.html'], recursive: true },
  { dir: 'scripts', exts: ['.mjs', '.js'], recursive: true },
];
const SKIP = new Set(['node_modules', 'dist', 'tests']);

function walk(dir, exts, recursive, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive && !SKIP.has(entry.name)) walk(full, exts, true, out);
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

const css = fs.readFileSync(SRC_CSS, 'utf-8').replace(/\r\n/g, '\n');
const firstIcon = css.indexOf('.ph.ph-');
const base = css.slice(css.indexOf('.ph {'), firstIcon).trim();
const rules = new Map();
for (const m of css.matchAll(/\.ph\.ph-([a-z0-9-]+):before \{\n[^}]*\}/g)) {
  rules.set(m[1], m[0]);
}

const files = [];
for (const { dir, exts, recursive } of SCAN) {
  walk(path.join(ROOT, dir), exts, recursive, files);
}
const used = new Set();
for (const file of files) {
  if (file === OUT) continue;
  const text = fs.readFileSync(file, 'utf-8');
  for (const m of text.matchAll(/\bph-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
    if (rules.has(m[1])) used.add(m[1]);
  }
}
const names = [...used].sort();

const fontUrl = path
  .relative(
    path.dirname(OUT),
    path.join(PKG, 'src', 'regular', 'Phosphor.woff2')
  )
  .split(path.sep)
  .join('/');

const body = `/* Dibuat oleh scripts/generate-phosphor-subset.mjs. Jangan disunting manual.
   Subset ikon Phosphor (regular) yang dipakai situs; font-display: swap agar
   teks tidak menunggu font ikon. */
@font-face {
  font-family: "Phosphor";
  src: url("${fontUrl}") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

${base}

${names.map((n) => rules.get(n)).join('\n\n')}
`;

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
if (prev.replace(/\r\n/g, '\n') !== body) fs.writeFileSync(OUT, body);
console.log(
  `[phosphor-subset] ${names.length} dari ${rules.size} ikon, ${files.length} berkas dipindai.`
);
