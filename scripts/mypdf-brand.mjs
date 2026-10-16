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
// Dinormalisasi ke LF: parser HTML browser mengubah CRLF jadi LF sebelum
// skrip dieksekusi, sehingga hash CSP harus dihitung dari teks LF yang sama
// (generate-security-headers.mjs memakai normalisasi yang sama).
const THEME_JS = fs
  .readFileSync(path.join(ROOT, 'public', 'theme.js'), 'utf-8')
  .replace(/\r\n/g, '\n');
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
  // og:locale sesuai bahasa situs (upstream hanya memasang en_US di beranda)
  const ogLocale =
    { id: 'id_ID', en: 'en_US' }[process.env.VITE_LOCK_LANGUAGE || ''] || '';
  if (ogLocale && document.querySelector('meta[property="og:type"]')) {
    let loc = document.querySelector('meta[property="og:locale"]');
    if (!loc) {
      loc = document.createElement('meta');
      loc.setAttribute('property', 'og:locale');
      document
        .querySelector('meta[property="og:type"]')
        .insertAdjacentElement('afterend', loc);
    }
    loc.setAttribute('content', ogLocale);
  }
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
        // Data upstream yang tidak berlaku untuk mypdf.id: deskripsi dan daftar
        // fitur berbahasa Inggris, nama alternatif, dan profil pembuat BentoPDF.
        const metaDesc = document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content');
        delete data.featureList;
        delete data.alternateName;
        if (data.mainEntity && data.mainEntity['@type'] === 'Person') {
          const { '@context': _ctx, ...org } = organizationLd;
          data.mainEntity = org;
        }
        const fixNested = (o) => {
          if (Array.isArray(o)) return o.forEach(fixNested);
          if (!o || typeof o !== 'object') return;
          if (o['@type'] === 'ListItem' && o.name === 'Home')
            o.name = 'Beranda';
          if (o['@type'] === 'Offer' && o.price === '0')
            o.priceCurrency = 'IDR';
          Object.values(o).forEach(fixNested);
        };
        fixNested(data);
        // Ganti merek dulu, baru isi nama dan deskripsi milik mypdf.id agar
        // kalimat seperti "berbasis BentoPDF" tidak ikut diganti.
        data = JSON.parse(rebrand(JSON.stringify(data)));
        if (typeof data.description === 'string' && metaDesc) {
          data.description = metaDesc;
        }
        if (page.title && typeof data.name === 'string') {
          data.name = page.title;
        }
        s.textContent = JSON.stringify(data, null, 2);
      }
    });

  // FAQPage harus sama dengan FAQ yang terlihat di halaman
  const faqItems = [];
  for (const details of document.querySelectorAll('.faq-list details.faq-d')) {
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

  // Landmark <main>: isi halaman berada di antara slot iklan atas dan bawah
  // (atau topbar dan footer) sebagai anak langsung <body>. Dibungkus <main
  // class="mp-main"> yang memakai display: contents agar tata letak tetap.
  if (!document.querySelector('main, [role="main"]')) {
    const { body } = document;
    const start =
      body.querySelector(':scope > #ad-slot-top') ||
      body.querySelector(':scope > header.mp-topbar');
    const end =
      body.querySelector(':scope > #ad-slot-bottom') ||
      body.querySelector(':scope > footer');
    if (
      start &&
      end &&
      start.compareDocumentPosition(end) &
        dom.window.Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      const main = document.createElement('main');
      main.className = 'mp-main';
      while (start.nextSibling && start.nextSibling !== end) {
        main.appendChild(start.nextSibling);
      }
      body.insertBefore(main, end);
    }
  }

  // Preload font Geist: tanpa ini font baru diminta setelah style.css selesai
  // diurai (rantai CSS -> font), yang di mobile lambat menunda LCP.
  if (!document.querySelector('link[rel="preload"][href*="Geist-Variable"]')) {
    const pl = document.createElement('link');
    pl.setAttribute('rel', 'preload');
    pl.setAttribute('as', 'font');
    pl.setAttribute('type', 'font/woff2');
    pl.setAttribute('href', '/fonts/geist/Geist-Variable.woff2');
    pl.setAttribute('crossorigin', '');
    document.head.insertBefore(pl, document.head.firstChild);
  }

  // Penginisialisasi tema (terang/gelap), di-inline agar tidak jadi permintaan
  // pemblokir render dan tidak berkedip. Karena CSP tidak mengizinkan
  // 'unsafe-inline', hash skripnya didaftarkan di script-src oleh
  // scripts/generate-security-headers.mjs (isi harus identik, lihat THEME_JS).
  if (!document.querySelector('script[data-mp-theme]')) {
    const ts = document.createElement('script');
    ts.setAttribute('data-mp-theme', '');
    ts.textContent = THEME_JS;
    document.head.insertBefore(ts, document.head.firstChild);
  }

  // Inline CSS landing (kecil, ~9 KiB) supaya satu permintaan pemblokir render
  // hilang. style-src sudah mengizinkan 'unsafe-inline'. Urutan cascade tetap
  // karena <style> menggantikan <link> di posisi yang sama.
  document
    .querySelectorAll('link[rel="stylesheet"][href^="/assets/landing-"]')
    .forEach((link) => {
      const cssPath = path.join(DIST_DIR, link.getAttribute('href'));
      if (!fs.existsSync(cssPath)) return;
      const style = document.createElement('style');
      style.textContent = fs.readFileSync(cssPath, 'utf-8');
      link.replaceWith(style);
    });

  // Urutan awal <head>: meta charset (wajib dalam 1.024 byte pertama),
  // viewport, skrip tema, stylesheet pemblokir render, lalu preload Geist.
  // Stylesheet didahulukan dari preload font dan modul JS agar tidak berebut
  // bandwidth di jaringan lambat. Stylesheet yang didahului <style> (beberapa
  // halaman alat) tidak dipindah agar urutan cascade tidak berubah.
  const head = document.head;
  const firstStyle = head.querySelector('style');
  const movableSheets = [
    ...head.querySelectorAll('link[rel="stylesheet"]'),
  ].filter(
    (link) =>
      !firstStyle ||
      !(
        firstStyle.compareDocumentPosition(link) &
        dom.window.Node.DOCUMENT_POSITION_FOLLOWING
      )
  );
  const ordered = [
    head.querySelector('meta[charset]'),
    head.querySelector('meta[name="viewport"]'),
    head.querySelector('script[data-mp-theme]'),
    ...movableSheets,
    head.querySelector('link[rel="preload"][href*="Geist-Variable"]'),
  ].filter(Boolean);
  for (const el of ordered.reverse()) head.insertBefore(el, head.firstChild);

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
