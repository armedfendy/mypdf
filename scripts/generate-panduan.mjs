// Membuat halaman /panduan/ (artikel panduan mypdf.id) dari content/panduan/*.md.
// Hanya berjalan saat MYPDF=true. Hasilnya ditulis ke panduan/*.html (diabaikan
// Git) agar ikut diproses Vite seperti halaman lain, lalu dirapikan oleh
// scripts/mypdf-brand.mjs.
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'content/panduan');
const OUT_DIR = path.join(ROOT, 'panduan');

if (process.env.MYPDF !== 'true') {
  console.log('[panduan] MYPDF tidak di-set, dilewati.');
  process.exit(0);
}

const SITE_URL = (process.env.SITE_URL || 'https://mypdf.id').replace(
  /\/+$/,
  ''
);
const NAME = process.env.VITE_BRAND_NAME || 'mypdf.id';
const LINK_CLASS = 'text-indigo-300 hover:text-indigo-400';

const escapeHtml = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function styleBody(html) {
  return html
    .replace(/<h2>/g, '<h2 class="text-2xl font-bold text-white mt-10 mb-4">')
    .replace(/<h3>/g, '<h3 class="text-xl font-semibold text-white mt-6 mb-2">')
    .replace(/<p>/g, '<p class="text-gray-300 leading-relaxed mb-5">')
    .replace(
      /<ol>/g,
      '<ol class="list-decimal list-outside ml-6 text-gray-300 leading-relaxed mb-5 space-y-2">'
    )
    .replace(
      /<ul>/g,
      '<ul class="list-disc list-outside ml-6 text-gray-300 leading-relaxed mb-5 space-y-2">'
    )
    .replace(/<strong>/g, '<strong class="text-white">')
    .replace(
      /<a href="http/g,
      `<a rel="noopener" class="${LINK_CLASS}" href="http`
    )
    .replace(/<a href="\//g, `<a class="${LINK_CLASS}" href="/`);
}

const renderInline = (md) => styleBody(marked.parseInline(md));

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

function parsePost(file) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: frontmatter JSON tidak ditemukan`);
  const meta = JSON.parse(match[1]);
  for (const key of [
    'title',
    'h1',
    'description',
    'date',
    'breadcrumb',
    'card',
  ]) {
    if (!meta[key]) throw new Error(`${file}: frontmatter kurang "${key}"`);
  }
  return { slug: file.replace(/\.md$/, ''), meta, body: match[2].trim() };
}

const headCommon = (
  title,
  description,
  url,
  ogType
) => `    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_URL}/images/og-tools.png" />
    <meta property="og:site_name" content="${NAME}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link href="/src/css/styles.css" rel="stylesheet" />`;

const scripts = `    <script type="module" src="/src/js/utils/lucide-init.ts"></script>
    <script type="module" src="/src/js/mobileMenu.ts"></script>`;

function renderFaqs(faqs) {
  if (!faqs || faqs.length === 0) return '';
  const items = faqs
    .map(
      (f) => `        <details class="faq-d">
          <summary class="faq-d-q">${escapeHtml(f.q)}<i data-lucide="plus" class="faq-d-icon"></i></summary>
          <p class="faq-d-a">
            ${renderInline(f.a)}
          </p>
        </details>`
    )
    .join('\n');
  return `
      <h2 class="text-2xl font-bold text-white mt-10 mb-4">Pertanyaan yang Sering Diajukan</h2>
      <div class="faq-list">
${items}
      </div>`;
}

function renderCta(cta) {
  if (!cta) return '';
  return `
      <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 my-10">
        <p class="text-white font-semibold mb-2">${escapeHtml(cta.heading)}</p>
        <p class="text-gray-400 mb-4">${escapeHtml(cta.text)}</p>
        <a
          href="${cta.href}"
          class="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg"
          >${escapeHtml(cta.label)}</a
        >
      </div>`;
}

function renderPost({ slug, meta, body }) {
  const url = `${SITE_URL}/panduan/${slug}`;
  const updated = meta.updated || meta.date;
  const bodyHtml = styleBody(marked.parse(body));
  return `<!doctype html>
<html lang="id">
  <head>
${headCommon(meta.title, meta.description, url, 'article')}
  </head>

  <body class="antialiased bg-gray-900">
    {{> navbar }}

    <article class="max-w-3xl mx-auto px-4 py-12">
      <nav class="flex items-center gap-2 text-sm text-gray-400 mb-6" aria-label="Breadcrumb">
        <a href="/panduan/" class="hover:text-indigo-300">Panduan</a>
        <span aria-hidden="true">›</span>
        <span class="text-gray-300">${escapeHtml(meta.breadcrumb)}</span>
      </nav>

      <h1 class="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
        ${escapeHtml(meta.h1)}
      </h1>

      <p class="mb-10 text-sm text-gray-400">
        Oleh Tim ${NAME} ·
        <time datetime="${updated}">Diperbarui ${formatDate(updated)}</time>
      </p>

${bodyHtml}
${renderCta(meta.cta)}
${renderFaqs(meta.faqs)}
    </article>

    {{> footer }}
${scripts}

    <script type="application/ld+json">
      ${JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: meta.h1,
          description: meta.description,
          url,
          inLanguage: 'id',
          datePublished: meta.date,
          dateModified: updated,
          image: `${SITE_URL}/images/og-tools.png`,
          author: { '@type': 'Organization', name: NAME, url: SITE_URL },
          publisher: {
            '@type': 'Organization',
            name: NAME,
            url: SITE_URL,
            logo: {
              '@type': 'ImageObject',
              url: `${SITE_URL}/images/favicon.svg`,
            },
          },
        },
        null,
        2
      )}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Beranda',
              item: `${SITE_URL}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Panduan',
              item: `${SITE_URL}/panduan/`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: meta.breadcrumb,
              item: url,
            },
          ],
        },
        null,
        2
      )}
    </script>
  </body>
</html>
`;
}

// Teks yang dicocokkan kotak pencarian di /panduan/ (src/js/panduan-search.ts):
// judul, ringkasan, subjudul artikel, dan pertanyaan FAQ. Isi artikel lengkap
// sengaja tidak disertakan agar halaman indeks tetap ringan.
function searchText({ meta, body }) {
  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1]);
  const faqs = (meta.faqs || []).map((f) => f.q);
  return [
    meta.h1,
    meta.breadcrumb,
    meta.card,
    meta.description,
    ...headings,
    ...faqs,
  ]
    .join(' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderIndex(posts) {
  const url = `${SITE_URL}/panduan/`;
  const title = `Panduan PDF Praktis | ${NAME}`;
  const description =
    'Panduan langkah demi langkah memakai PDF: edit, tanda tangan, kecilkan ukuran, gabung, dan konversi Word. Semua tanpa upload file ke server.';
  const cards = posts
    .map(
      (post) => `        <a
          href="/panduan/${post.slug}"
          data-search="${escapeHtml(searchText(post))}"
          class="block bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-indigo-500 transition-colors"
        >
          <h2 class="text-xl font-bold text-white mb-2">${escapeHtml(post.meta.h1)}</h2>
          <p class="text-gray-400 mb-3">${escapeHtml(post.meta.card)}</p>
          <span class="text-sm text-gray-500">${formatDate(post.meta.updated || post.meta.date)}</span>
        </a>`
    )
    .join('\n\n');
  return `<!doctype html>
<html lang="id">
  <head>
${headCommon(title, description, url, 'website')}
  </head>

  <body class="antialiased bg-gray-900">
    {{> navbar }}

    <section class="max-w-3xl mx-auto px-4 py-12">
      <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">Panduan PDF</h1>
      <p class="text-gray-300 leading-relaxed mb-2">
        Cara-cara praktis mengerjakan urusan PDF sehari-hari, dari mendaftar
        CPNS atau beasiswa sampai mengirim dokumen kerja. Semua langkah memakai
        alat ${NAME} yang berjalan di browser Anda, jadi file tidak pernah
        di-upload.
      </p>
    </section>

    <section class="max-w-3xl mx-auto px-4 pb-16">
      <form role="search" class="mb-6" action="/panduan/" method="get">
        <label for="panduan-search" class="sr-only">Cari panduan</label>
        <div class="relative">
          <i
            data-lucide="search"
            class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          ></i>
          <input
            id="panduan-search"
            name="q"
            type="search"
            placeholder="Cari panduan, mis. tanda tangan, kecilkan, CPNS..."
            autocomplete="off"
            spellcheck="false"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <p id="panduan-search-count" class="text-sm text-gray-400 mt-2" aria-live="polite"></p>
      </form>

      <div id="panduan-list" class="space-y-6">
${cards}
      </div>

      <p id="panduan-search-empty" class="text-gray-400" hidden>
        Tidak ada panduan yang cocok. Coba kata lain, atau cari alatnya lewat
        menu <a href="/tools" class="${LINK_CLASS}">Semua Alat</a>.
      </p>
    </section>

    {{> footer }}
${scripts}
    <script type="module" src="/src/js/panduan-search.ts"></script>

    <script type="application/ld+json">
      ${JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          url,
          inLanguage: 'id',
          description,
          publisher: { '@type': 'Organization', name: NAME, url: SITE_URL },
        },
        null,
        2
      )}
    </script>
  </body>
</html>
`;
}

if (!fs.existsSync(POSTS_DIR)) {
  console.log('[panduan] content/panduan tidak ada, dilewati.');
  process.exit(0);
}
const posts = fs
  .readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map(parsePost);
posts.sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const post of posts) {
  fs.writeFileSync(path.join(OUT_DIR, `${post.slug}.html`), renderPost(post));
}
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(posts));
console.log(`[panduan] ${posts.length} artikel + indeks dibuat di panduan/.`);
