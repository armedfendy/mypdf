/**
 * mypdf.id — terjemahan teks yang tertulis langsung di HTML/JS upstream.
 *
 * Aktif hanya bila MYPDF=true. Dijalankan setelah mypdf-single-locale.mjs dan
 * sebelum mypdf-brand.mjs (agar FAQPage dibuat dari teks yang sudah
 * diterjemahkan).
 *
 * Sumber kamus:
 *   1. Otomatis: pasangan teks public/locales/en/*.json -> public/locales/<id>/*.json
 *   2. Manual  : content/i18n/<id>.json  { "teks Inggris": "terjemahan" }
 *      Kunci boleh berisi placeholder {x}, misalnya
 *      "Pages (e.g., 1-3, 5) - Total: {n}": "Halaman (mis. 1-3, 5), total: {n}"
 *
 * Yang dilakukan pada setiap HTML di dist/:
 *   - Bila ada content/tools/<halaman>.html, semua bagian SEO bawaan (setiap
 *     <section> di level <body>: intro, How It Works, Related Tools, FAQ)
 *     diganti dengan konten tersebut.
 *   - Teks dan atribut (placeholder, title, aria-label, alt) yang cocok
 *     persis dengan kamus diterjemahkan.
 *   - Menyisipkan /mypdf-i18n.js: menerjemahkan teks yang dibuat JavaScript
 *     saat halaman berjalan, memakai kamus manual.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const LANG = (process.env.VITE_LOCK_LANGUAGE || '').trim();

if (process.env.MYPDF !== 'true' || !LANG) {
  console.log(
    '[mypdf-translate] MYPDF/VITE_LOCK_LANGUAGE tidak di-set, dilewati.'
  );
  process.exit(0);
}

const SKIP_DIRS = new Set([
  'assets',
  'docs',
  'pdfjs-viewer',
  'pdfjs-annotation-viewer',
  'libreoffice-wasm',
  'locales',
  'images',
  'workers',
]);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SEO_SECTION_KEYS = [
  'howItWorks.title',
  'relatedTools.title',
  'faq.sectionTitle',
];

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const readJson = (f) =>
  fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : {};

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

// ---- Kamus ----
const exact = new Map();
const patterns = [];

function addEntry(en, tr, overwrite) {
  const key = norm(en);
  const val = norm(tr);
  if (!key || !val || key === val || !/[a-z]/i.test(key)) return;
  if (/\{\{?\w+\}?\}/.test(key)) {
    const names = [];
    const re = new RegExp(
      '^' +
        key
          .split(/(\{\{?\w+\}?\})/)
          .map((part) => {
            const m = part.match(/^\{\{?(\w+)\}?\}$/);
            if (m) {
              names.push(m[1]);
              return '(.+?)';
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('') +
        '$'
    );
    patterns.push({ re, names, val });
    return;
  }
  if (overwrite || !exact.has(key)) exact.set(key, val);
}

for (const ns of ['common', 'tools']) {
  const en = flatten(
    readJson(path.join(ROOT, 'public/locales/en', `${ns}.json`))
  );
  const tr = flatten(
    readJson(path.join(ROOT, 'public/locales', LANG, `${ns}.json`))
  );
  for (const [k, v] of Object.entries(en)) if (tr[k]) addEntry(v, tr[k], false);
}
const localeTools = readJson(
  path.join(ROOT, 'public/locales', LANG, 'tools.json')
);
const manual = readJson(path.join(ROOT, 'content/i18n', `${LANG}.json`));
for (const [en, tr] of Object.entries(manual)) addEntry(en, tr, true);

function translate(text) {
  const key = norm(text);
  if (!key) return null;
  if (exact.has(key)) return exact.get(key);
  for (const p of patterns) {
    const m = key.match(p.re);
    if (m) {
      let out = p.val;
      p.names.forEach((n, i) => {
        out = out
          .split(`{{${n}}}`)
          .join(m[i + 1])
          .split(`{${n}}`)
          .join(m[i + 1]);
      });
      return out;
    }
  }
  return null;
}

// ---- Halaman ----
function walkHtml(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) {
      if (!prefix && SKIP_DIRS.has(entry)) continue;
      out.push(...walkHtml(full, rel));
    } else if (entry.endsWith('.html')) out.push(rel);
  }
  return out;
}

function writeWithCompressed(target, content) {
  fs.writeFileSync(target, content);
  const buf = Buffer.from(content);
  if (fs.existsSync(`${target}.br`)) {
    fs.writeFileSync(`${target}.br`, zlib.brotliCompressSync(buf));
  }
  if (fs.existsSync(`${target}.gz`)) {
    fs.writeFileSync(`${target}.gz`, zlib.gzipSync(buf, { level: 9 }));
  }
}

let replacedSections = 0;
let translatedNodes = 0;

function transform(html, pageKey) {
  const dom = new JSDOM(html);
  const { document, NodeFilter } = dom.window;

  // Konten SEO milik mypdf.id
  const contentFile = path.join(ROOT, 'content/tools', `${pageKey}.html`);
  if (fs.existsSync(contentFile)) {
    // Semua <section> di level <body> adalah konten SEO bawaan (UI alat ada
    // di dalam <div>). Bila tidak ada, cari lewat judul bagian standar.
    let sections = [...document.querySelectorAll('body > section')];
    if (sections.length === 0) {
      sections = SEO_SECTION_KEYS.map((k) =>
        document.querySelector(`h2[data-i18n="${k}"]`)
      )
        .filter(Boolean)
        .map((h2) => h2.closest('section'))
        .filter(Boolean);
    }
    if (sections.length > 0) {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-mypdf-content', pageKey);
      wrapper.innerHTML = fs.readFileSync(contentFile, 'utf-8');
      sections[0].parentNode.insertBefore(wrapper, sections[0]);
      sections.forEach((s) => s.remove());
      document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((s) => {
          if (/"@type"\s*:\s*"(HowTo|FAQPage)"/.test(s.textContent || '')) {
            s.remove();
          }
        });
      replacedSections++;
    }
  }

  // Kartu alat statis (#tool-grid): nama & deskripsi dari locale per alat
  document
    .querySelectorAll('#tool-grid > a[href^="/"], #tools-grid > a[href^="/"]')
    .forEach((a) => {
      const slug = a
        .getAttribute('href')
        .slice(1)
        .replace(/\.html$/, '');
      const key = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
      const tool = localeTools[key];
      if (!tool) return;
      const h3 = a.querySelector('h3');
      const p = a.querySelector('p');
      if (h3 && tool.name) h3.textContent = tool.name;
      if (p && tool.subtitle) p.textContent = tool.subtitle;
    });

  // Teks
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  for (const n of nodes) {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
    const tr = translate(n.textContent);
    if (tr) {
      const lead = n.textContent.match(/^\s*/)[0];
      const trail = n.textContent.match(/\s*$/)[0];
      n.textContent = `${lead}${tr}${trail}`;
      translatedNodes++;
    }
  }

  // Atribut
  for (const attr of ATTRS) {
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
      const tr = translate(el.getAttribute(attr) || '');
      if (tr) el.setAttribute(attr, tr);
    });
  }

  // Penerjemah runtime
  if (!document.querySelector('script[data-mypdf-i18n]')) {
    const s = document.createElement('script');
    s.setAttribute('src', '/mypdf-i18n.js');
    s.setAttribute('defer', '');
    s.setAttribute('data-mypdf-i18n', '');
    document.head.appendChild(s);
  }

  const result = dom.serialize();
  dom.window.close();
  return result;
}

// ---- Data alat di bundle JS (tools.html merender ulang grid saat filter/cari) ----
// Judul alat diganti dengan nama dari locale agar tampilan dan pencarian
// berbahasa Indonesia. File yang berubah diberi nama baru (hash isi) supaya
// cache "immutable" di browser tidak menyajikan versi lama.
const TOOL_ENTRY =
  /(name:\s*([`'"])([a-z0-9-]+)\2\s*,\s*title:\s*)([`'"])((?:(?!\4)[^\\]|\\.)*)\4/g;
const renamed = new Map();
const assetsDir = path.join(DIST_DIR, 'assets');
let patchedTitles = 0;
if (fs.existsSync(assetsDir)) {
  for (const file of fs.readdirSync(assetsDir)) {
    if (!file.endsWith('.js')) continue;
    const full = path.join(assetsDir, file);
    const src = fs.readFileSync(full, 'utf-8');
    let count = 0;
    const out = src.replace(TOOL_ENTRY, (m, head, _q, slug) => {
      const key = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
      const name = localeTools[key] && localeTools[key].name;
      if (!name) return m;
      count++;
      return `${head}${JSON.stringify(name)}`;
    });
    if (!count || out === src) continue;
    patchedTitles += count;
    const hash = crypto
      .createHash('sha256')
      .update(out)
      .digest('base64url')
      .slice(0, 8);
    const m = file.match(/^(.*)-[A-Za-z0-9_-]{8}\.js$/);
    const newName = m ? `${m[1]}-${hash}.js` : file;
    for (const ext of ['', '.br', '.gz']) {
      if (fs.existsSync(full + ext)) fs.rmSync(full + ext);
    }
    fs.writeFileSync(path.join(assetsDir, newName), out);
    if (newName !== file) renamed.set(file, newName);
  }
}
function applyRenames(text) {
  for (const [from, to] of renamed) text = text.split(from).join(to);
  return text;
}
if (renamed.size && fs.existsSync(assetsDir)) {
  for (const file of fs.readdirSync(assetsDir)) {
    if (!/\.(js|css)$/.test(file)) continue;
    const full = path.join(assetsDir, file);
    const src = fs.readFileSync(full, 'utf-8');
    const out = applyRenames(src);
    if (out !== src) writeWithCompressed(full, out);
  }
}

const files = walkHtml(DIST_DIR);
for (const rel of files) {
  const full = path.join(DIST_DIR, rel);
  writeWithCompressed(
    full,
    transform(
      applyRenames(fs.readFileSync(full, 'utf-8')),
      rel.replace(/\.html$/, '')
    )
  );
}

// ---- Runtime: hanya kamus manual (teks yang dibuat JavaScript) ----
const runtimeExact = {};
const runtimePatterns = [];
for (const [en, tr] of Object.entries(manual)) {
  const key = norm(en);
  if (/\{\w+\}/.test(key)) runtimePatterns.push([key, norm(tr)]);
  else runtimeExact[key] = norm(tr);
}
const runtime = `/* Dibuat otomatis oleh scripts/mypdf-translate.mjs. Jangan diedit manual. */
(() => {
  const E = ${JSON.stringify(runtimeExact)};
  const P = ${JSON.stringify(runtimePatterns)}.map(([k, v]) => {
    const names = [];
    const re = new RegExp('^' + k.split(/(\\{\\w+\\})/).map((p) => {
      const m = p.match(/^\\{(\\w+)\\}$/);
      if (m) { names.push(m[1]); return '(.+?)'; }
      return p.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    }).join('') + '$');
    return { re, names, v };
  });
  const ATTRS = ${JSON.stringify(ATTRS)};
  const norm = (s) => s.replace(/\\s+/g, ' ').trim();
  const tr = (s) => {
    const k = norm(s);
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(E, k)) return E[k];
    for (const p of P) {
      const m = k.match(p.re);
      if (m) {
        let out = p.v;
        p.names.forEach((n, i) => { out = out.split('{' + n + '}').join(m[i + 1]); });
        return out;
      }
    }
    return null;
  };
  const textNode = (n) => {
    const p = n.parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.tagName) || p.isContentEditable) return;
    const t = tr(n.nodeValue);
    if (t !== null && t !== norm(n.nodeValue)) {
      const lead = n.nodeValue.match(/^\\s*/)[0];
      const trail = n.nodeValue.match(/\\s*$/)[0];
      n.nodeValue = lead + t + trail;
    }
  };
  const element = (el) => {
    for (const a of ATTRS) {
      if (el.hasAttribute && el.hasAttribute(a)) {
        const t = tr(el.getAttribute(a));
        if (t !== null) el.setAttribute(a, t);
      }
    }
  };
  const walk = (root) => {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? textNode(n) : element(n);
  };
  const start = () => {
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') element(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
`;
fs.writeFileSync(path.join(DIST_DIR, 'mypdf-i18n.js'), runtime);

console.log(
  `[mypdf-translate] Kamus: ${exact.size} teks + ${patterns.length} pola. ` +
    `${translatedNodes} teks diterjemahkan, ${replacedSections} halaman memakai konten SEO mypdf.id, ` +
    `${patchedTitles} judul alat di bundle JS (${renamed.size} file diganti nama).`
);
