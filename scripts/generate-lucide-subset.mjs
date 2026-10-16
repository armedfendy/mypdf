/**
 * mypdf.id — subset ikon lucide untuk modul yang dimuat di semua halaman.
 *
 * main.ts, lucide-init.ts dan searchPalette.ts dulu memanggil
 * createIcons({ icons }) dengan seluruh koleksi lucide (~1.900 ikon, ±83 KiB
 * gzip) di setiap halaman. Skrip ini memindai semua nama ikon yang ditulis
 * statis (data-lucide="..." di HTML/TS/skrip build, setAttribute('data-lucide',
 * '...')) lalu menulis src/js/utils/lucide-icons.ts yang hanya mengimpor ikon
 * tersebut. Modul halaman alat tetap mengimpor koleksi penuh untuk ikon
 * dinamisnya.
 *
 * Dijalankan otomatis di awal `npm run build`; hasilnya ikut di-commit.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'js', 'utils', 'lucide-icons.ts');
const { icons } = createRequire(import.meta.url)('lucide');

const SCAN = [
  { dir: '.', exts: ['.html'], recursive: false },
  { dir: 'src', exts: ['.html', '.ts'], recursive: true },
  { dir: 'content', exts: ['.html', '.md'], recursive: true },
  { dir: 'blog', exts: ['.html'], recursive: true },
  { dir: 'panduan', exts: ['.html'], recursive: true },
  { dir: 'scripts', exts: ['.mjs', '.js'], recursive: true },
];
const SKIP = new Set(['node_modules', 'dist', 'tests']);

const PATTERNS = [
  /data-lucide=\\?["']([a-z0-9-]+)\\?["']/g,
  /['"]data-lucide['"]\s*,\s*['"]([a-z0-9-]+)['"]/g,
];

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

const files = [];
for (const { dir, exts, recursive } of SCAN) {
  walk(path.join(ROOT, dir), exts, recursive, files);
}

const toPascal = (name) =>
  name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

const names = new Set();
for (const file of files) {
  if (file === OUT) continue;
  const text = fs.readFileSync(file, 'utf-8');
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) names.add(m[1]);
  }
}

// Nama ekspor -> berkas ikon, dibaca dari modul ESM utama lucide (termasuk
// alias, mis. AlertCircle -> circle-alert.js). Ikon diimpor langsung dari
// berkasnya agar modul utama 'lucide' tidak ikut termuat (lihat lucide-lite.ts).
const lucideEsm = fs.readFileSync(
  path.join(ROOT, 'node_modules', 'lucide', 'dist', 'esm', 'lucide.js'),
  'utf-8'
);
const fileOf = new Map();
for (const m of lucideEsm.matchAll(
  /export \{([^}]+)\} from '\.\/icons\/([a-z0-9-]+)\.js';/g
)) {
  for (const part of m[1].split(',')) {
    const alias = part.trim().replace(/^default as /, '');
    fileOf.set(alias, m[2]);
  }
}

const found = [];
const unknown = [];
for (const name of names) {
  const pascal = toPascal(name);
  if (icons[pascal] && fileOf.has(pascal)) found.push(pascal);
  else unknown.push(name);
}
const sorted = [...new Set(found)].sort();

const body = `// Dibuat oleh scripts/generate-lucide-subset.mjs. Jangan disunting manual.
// Subset ikon lucide yang ditulis statis di HTML/TS; dipakai modul yang
// dimuat di semua halaman agar tidak menarik seluruh koleksi lucide.
import type { IconNode } from 'lucide';
${sorted.map((n) => `import ${n} from 'lucide/dist/esm/icons/${fileOf.get(n)}.js';`).join('\n')}

export const icons: Record<string, IconNode> = {
${sorted.map((n) => `  ${n},`).join('\n')}
};
`;

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
if (prev.replace(/\r\n/g, '\n') !== body) fs.writeFileSync(OUT, body);
console.log(
  `[lucide-subset] ${sorted.length} ikon dari ${files.length} berkas.` +
    (unknown.length ? ` Tidak dikenal lucide: ${unknown.join(', ')}` : '')
);
