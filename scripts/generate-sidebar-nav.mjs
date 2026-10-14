// Membuat src/partials/sidebar-nav-mypdf.html: menu sidebar berkelompok
// (nama alat berbahasa Indonesia) dari src/js/config/tools.ts. Berkas hasilnya
// diabaikan Git dan dibuat ulang pada setiap build.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/partials/sidebar-nav-mypdf.html');

const unescapeTs = (v) => v.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toolsSrc = fs.readFileSync(
  path.join(ROOT, 'src/js/config/tools.ts'),
  'utf-8'
);
const mainSrc = fs.readFileSync(path.join(ROOT, 'src/js/main.ts'), 'utf-8');
const id = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/locales/id/tools.json'), 'utf-8')
);
const pages = new Set(
  fs
    .readdirSync(path.join(ROOT, 'src/pages'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))
);

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
const cats = headers.map((h) => ({ name: h.name, tools: [] }));

for (const match of toolsSrc.matchAll(
  /\{[^{}]*?href:\s*import\.meta\.env\.BASE_URL\s*\+\s*'((?:[^'\\]|\\.)*)'[^{}]*?\}/gs
)) {
  const block = match[0];
  const slug = unescapeTs(match[1]).replace(/\.html$/, '');
  if (!pages.has(slug)) continue;
  const nameEn = block.match(/name:\s*'((?:[^'\\]|\\.)*)'/s)?.[1];
  if (!nameEn) continue;
  const icon = block.match(/icon:\s*'([^']+)'/)?.[1] || 'file';
  let ci = -1;
  for (let i = 0; i < headers.length; i++)
    if (headers[i].index < match.index) ci = i;
  if (ci === -1) continue;
  const en = unescapeTs(nameEn);
  const tk = toolKeys[en];
  cats[ci].tools.push({
    slug,
    icon,
    name: (tk && lookup(`${tk}.name`)) || en,
  });
}

const iconHtml = (name) =>
  name.startsWith('ph-')
    ? `<i class="ph ${esc(name)}" aria-hidden="true"></i>`
    : `<i data-lucide="${esc(name)}" aria-hidden="true"></i>`;

const link = (href, icon, label) =>
  `<a href="${esc(href)}" class="mp-side-link">${iconHtml(icon)}<span>${esc(label)}</span></a>`;

const chevron =
  '<i data-lucide="chevron-down" class="mp-grp-chev" aria-hidden="true"></i>';
const group = (label, items) => `    <section class="mp-grp">
      <button type="button" class="mp-grp-head" aria-expanded="true">
        <span>${esc(label)}</span>${chevron}
      </button>
      <div class="mp-grp-body">
        ${items.join('\n        ')}
      </div>
    </section>`;

const parts = [];
parts.push(
  `    <a href="/" class="mp-side-link mp-side-home" data-nav-home><i data-lucide="layout-dashboard" aria-hidden="true"></i><span>Beranda</span></a>`
);

cats.forEach((c, idx) => {
  if (c.tools.length === 0) return;
  const label = (catKeys[c.name] && lookup(catKeys[c.name])) || c.name;
  const items = c.tools.map((t) => link(`/${t.slug}`, t.icon, t.name));
  if (idx === 0) {
    parts.push(`    <p class="mp-side-label"><i data-lucide="star" aria-hidden="true"></i><span>${esc(label)}</span></p>
    <div class="mp-grp-body mp-grp-static">
        ${items.join('\n        ')}
    </div>`);
  } else {
    parts.push(group(label, items));
  }
});

parts.push(
  group('Bantuan', [
    link('/panduan/', 'book-open', 'Panduan'),
    link('/faq', 'circle-help', 'FAQ'),
    link('/about', 'info', 'Tentang'),
    link('/contact', 'mail', 'Kontak'),
    `<a href="https://github.com/armedfendy/mypdf" target="_blank" rel="noopener noreferrer" class="mp-side-link"><i data-lucide="code-xml" aria-hidden="true"></i><span>Kode Sumber</span></a>`,
  ])
);

fs.writeFileSync(
  OUT,
  `<!-- Dibuat otomatis oleh scripts/generate-sidebar-nav.mjs. Jangan diedit. -->\n<nav class="mp-side-nav" id="mp-side-nav" aria-label="Alat PDF">\n${parts.join('\n')}\n</nav>\n`
);
const total = cats.reduce((n, c) => n + c.tools.length, 0);
console.log(
  `[sidebar-nav] ${total} tautan alat ditulis ke sidebar-nav-mypdf.html.`
);
