// Membuat dist/search-index.json (daftar alat berbahasa Indonesia) untuk modal
// pencarian Ctrl+K. Hanya berjalan saat MYPDF=true.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
if (process.env.MYPDF !== 'true') {
  console.log('[search-index] MYPDF tidak di-set, dilewati.');
  process.exit(0);
}

const unescapeTs = (v) => v.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const toolsSrc = fs.readFileSync(
  path.join(ROOT, 'src/js/config/tools.ts'),
  'utf-8'
);
const mainSrc = fs.readFileSync(path.join(ROOT, 'src/js/main.ts'), 'utf-8');
const id = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/locales/id/tools.json'), 'utf-8')
);
const distDir = path.join(ROOT, 'dist');

function keyMap(varName) {
  const m = mainSrc.match(
    new RegExp(`const ${varName}[^=]*=\\s*\\{([\\s\\S]*?)\\n  \\};`)
  );
  const map = {};
  if (!m) return map;
  for (const e of m[1].matchAll(/'((?:[^'\\]|\\.)*)':\s*'([^']+)'/g)) {
    map[unescapeTs(e[1])] = e[2].replace(/^tools:/, '');
  }
  return map;
}
const toolKeys = keyMap('toolTranslationKeys');
const catKeys = keyMap('categoryTranslationKeys');
const lookup = (dotted) =>
  dotted.split('.').reduce((o, k) => (o ? o[k] : undefined), id);

const headers = [
  ...toolsSrc.matchAll(/name:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*tools:\s*\[/g),
].map((m) => ({ name: unescapeTs(m[1]), index: m.index }));

const byHref = new Map();
for (const match of toolsSrc.matchAll(
  /\{[^{}]*?href:\s*import\.meta\.env\.BASE_URL\s*\+\s*'((?:[^'\\]|\\.)*)'[^{}]*?\}/gs
)) {
  const block = match[0];
  const slug = unescapeTs(match[1]).replace(/\.html$/, '');
  if (!fs.existsSync(path.join(distDir, `${slug}.html`))) continue;
  const nameEn = block.match(/name:\s*'((?:[^'\\]|\\.)*)'/s)?.[1];
  if (!nameEn) continue;
  const subEn =
    block.match(/subtitle:\s*\n?\s*'((?:[^'\\]|\\.)*)'/s)?.[1] || '';
  const icon = block.match(/icon:\s*'([^']+)'/)?.[1] || 'file';
  let cat = null;
  for (const h of headers) if (h.index < match.index) cat = h.name;
  const en = unescapeTs(nameEn);
  const tk = toolKeys[en];
  const name = (tk && lookup(`${tk}.name`)) || en;
  const subtitle = (tk && lookup(`${tk}.subtitle`)) || unescapeTs(subEn);
  const ck = catKeys[cat];
  const category = (ck && lookup(ck)) || cat;
  const row = { n: name, s: subtitle, c: category, h: `/${slug}`, i: icon };
  const prev = byHref.get(slug);
  // Alat Populer hanya dipakai bila alat tidak punya kategori lain.
  if (!prev || (prev.pop && cat !== 'Popular Tools')) {
    byHref.set(slug, { ...row, pop: cat === 'Popular Tools' });
  }
}

const tools = [...byHref.values()].map(({ pop, ...r }) => r);
fs.writeFileSync(
  path.join(distDir, 'search-index.json'),
  JSON.stringify({ tools })
);
console.log(
  `[search-index] ${tools.length} alat ditulis ke dist/search-index.json.`
);
