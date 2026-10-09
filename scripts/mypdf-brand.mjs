/**
 * mypdf.id — branding post-build step.
 *
 * Aktif hanya bila MYPDF=true. Membaca mypdf.config.json lalu, pada setiap
 * HTML di dist/:
 *   - mengganti merek "BentoPDF" di <title> dan meta (og, twitter, author)
 *   - memasang judul & deskripsi khusus untuk halaman di config.pages
 *   - mengganti JSON-LD Organization dan membuang FAQPage berbahasa Inggris
 *   - membuang elemen yang khusus milik BentoPDF (config.removeSelectors)
 *   - mengganti isi #app dengan content/pages/<halaman>.html bila ada
 * Halaman produk/lisensi BentoPDF (config.removePages) dihapus dari dist/ dan
 * sitemap.xml. File HTML upstream tidak diubah sama sekali.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

if (process.env.MYPDF !== 'true') {
  console.log('[mypdf-brand] MYPDF tidak di-set, dilewati.');
  process.exit(0);
}

const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'mypdf.config.json'), 'utf-8')
);
const SITE_URL = (process.env.SITE_URL || 'https://www.bentopdf.com').replace(
  /\/+$/,
  ''
);
const NAME = config.siteName;
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

const rebrand = (text) =>
  text
    .replace(/https?:\/\/(www\.)?bentopdf\.com/g, SITE_URL)
    .replace(/Bento ?PDF/g, NAME);

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

function removeFileWithCompressed(target) {
  for (const f of [target, `${target}.br`, `${target}.gz`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

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

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/images/favicon.svg`,
  sameAs: [config.sourceUrl],
};

function setMeta(document, selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.setAttribute('content', value);
  });
}

const CONTENT_DIR = path.join(ROOT, 'content', 'pages');

function transform(html, pageKey) {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const page = config.pages[pageKey] || {};

  // Isi halaman milik mypdf.id (content/pages/<halaman>.html) menggantikan
  // isi #app bawaan BentoPDF.
  const contentFile = path.join(CONTENT_DIR, `${pageKey}.html`);
  const app = document.getElementById('app');
  if (app && fs.existsSync(contentFile)) {
    app.innerHTML = fs.readFileSync(contentFile, 'utf-8');
  }

  // Judul & meta
  document.title = page.title || rebrand(document.title);
  for (const sel of [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ]) {
    document.querySelectorAll(sel).forEach((el) => {
      el.setAttribute(
        'content',
        page.title || rebrand(el.getAttribute('content') || '')
      );
    });
  }
  for (const sel of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]) {
    document.querySelectorAll(sel).forEach((el) => {
      el.setAttribute(
        'content',
        page.description || rebrand(el.getAttribute('content') || '')
      );
    });
  }
  setMeta(document, 'meta[property="og:site_name"]', NAME);
  setMeta(document, 'meta[name="author"]', NAME);
  setMeta(document, 'meta[name="apple-mobile-web-app-title"]', NAME);
  setMeta(document, 'meta[name="application-name"]', NAME);
  // twitter:site/creator milik akun BentoPDF; meta keywords berbahasa Inggris
  // dan tidak dipakai Google.
  document
    .querySelectorAll(
      'meta[name="twitter:site"], meta[name="twitter:creator"], meta[name="keywords"]'
    )
    .forEach((el) => el.remove());
  for (const sel of [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'link[rel="canonical"]',
    'meta[property="og:url"]',
    'meta[name="twitter:url"]',
  ]) {
    document.querySelectorAll(sel).forEach((el) => {
      const attr = el.tagName === 'LINK' ? 'href' : 'content';
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, rebrand(v));
    });
  }

  // JSON-LD
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((s) => {
      let data;
      try {
        data = JSON.parse(s.textContent || '');
      } catch {
        return;
      }
      if (data['@type'] === 'Organization') {
        s.textContent = JSON.stringify(organizationLd, null, 2);
      } else if (data['@type'] === 'FAQPage') {
        s.remove(); // dibuat ulang dari FAQ yang terlihat (lihat di bawah)
      } else {
        if (page.title && typeof data.name === 'string') {
          data.name = page.title;
          s.textContent = rebrand(JSON.stringify(data, null, 2));
        } else {
          s.textContent = rebrand(s.textContent);
        }
      }
    });

  // FAQPage harus sama dengan FAQ yang terlihat di halaman
  const faqItems = [];
  for (const details of document.querySelectorAll('details.faq-d')) {
    const q = details.querySelector('summary');
    const a = details.querySelector('p');
    const question = q ? q.textContent.replace(/\s+/g, ' ').trim() : '';
    const answer = a ? a.textContent.replace(/\s+/g, ' ').trim() : '';
    if (question && answer) {
      faqItems.push({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      });
    }
  }
  if (faqItems.length > 0) {
    const faq = document.createElement('script');
    faq.setAttribute('type', 'application/ld+json');
    faq.textContent = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems,
      },
      null,
      2
    );
    document.body.appendChild(faq);
  }

  // Tautan ke halaman yang dihapus dan ke situs BentoPDF
  const deadHrefs = new Set(config.removePages.map((n) => `/${n}`));
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (deadHrefs.has(href) || /bentopdf\.com\/docs/.test(href)) {
      const li = a.parentElement;
      if (li && li.tagName === 'LI' && li.children.length === 1) li.remove();
      else a.remove();
    }
  });

  // Elemen khusus BentoPDF
  for (const sel of config.removeSelectors) {
    document.querySelectorAll(sel).forEach((el) => {
      (el.id ? el : el.closest('section') || el).remove();
    });
  }

  const result = dom.serialize();
  dom.window.close();
  return result;
}

// 1. Hapus halaman produk/lisensi BentoPDF
for (const name of config.removePages) {
  removeFileWithCompressed(path.join(DIST_DIR, `${name}.html`));
}

// 2. Branding semua halaman
const files = walkHtml(DIST_DIR);
for (const rel of files) {
  const full = path.join(DIST_DIR, rel);
  const key = rel.replace(/\.html$/, '');
  writeWithCompressed(full, transform(fs.readFileSync(full, 'utf-8'), key));
}
console.log(`[mypdf-brand] ${files.length} halaman di-rebrand ke ${NAME}.`);

// 3. Sitemap tanpa halaman yang dihapus
const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  let xml = fs.readFileSync(sitemapPath, 'utf-8');
  for (const name of config.removePages) {
    const re = new RegExp(
      `\\s*<url>\\s*<loc>[^<]*/${name}</loc>[\\s\\S]*?</url>`,
      'g'
    );
    xml = xml.replace(re, '');
  }
  writeWithCompressed(sitemapPath, xml);
}

console.log('[mypdf-brand] Selesai.');
