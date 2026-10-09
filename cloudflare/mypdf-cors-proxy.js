/**
 * mypdf.id — CORS proxy untuk Tanda Tangan Digital dan Cap Waktu PDF.
 *
 * Membungkus cors-proxy-worker.js (BentoPDF) tanpa mengubahnya. Worker asli
 * hanya menerima origin bentopdf.com, jadi pembungkus ini:
 *   1. menolak semua origin selain ALLOWED_ORIGINS (variabel di
 *      mypdf-cors-proxy.toml),
 *   2. meneruskan permintaan ke worker asli dengan origin yang dikenalinya,
 *   3. mengembalikan header Access-Control-Allow-Origin ke origin asli.
 * Semua pengaman worker asli (daftar URL sertifikat/TSA, blokir IP privat,
 * batas ukuran, rate limit KV, HMAC opsional) tetap berlaku.
 *
 * Deploy: npx wrangler deploy -c cloudflare/mypdf-cors-proxy.toml
 */
import upstream from './cors-proxy-worker.js';

const UPSTREAM_ORIGIN = 'https://bentopdf.com';

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    if (!origin || !allowedOrigins(env).includes(origin)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'This proxy only accepts requests from allowed origins',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const headers = new Headers(request.headers);
    headers.set('Origin', UPSTREAM_ORIGIN);
    const response = await upstream.fetch(
      new Request(request, { headers }),
      env,
      ctx
    );

    const out = new Response(response.body, response);
    if (out.headers.has('Access-Control-Allow-Origin')) {
      out.headers.set('Access-Control-Allow-Origin', origin);
    }
    return out;
  },
};
