/**
 * mypdf.id: Cloudflare Pages Function untuk /config.json.
 *
 * Menyajikan public/config.json (aset statis) yang digabung dengan saklar dari
 * Cloudflare KV, agar iklan bisa dimatikan TANPA build ulang:
 *
 *   KV binding : MYPDF_FLAGS   (Pages > Settings > Bindings > KV namespace)
 *   Kunci      : ADS_ENABLED   nilai "true" atau "false"
 *
 * Mengubah nilai ADS_ENABLED di dasbor Cloudflare berlaku dalam ±1 menit
 * (cache KV 60 detik); browser mengambil config.json dengan cache: 'no-cache'
 * dan service worker memakai network-first untuk berkas ini.
 *
 * Bila binding belum dipasang, kunci tidak ada, atau KV gagal dibaca, isi
 * config.json statis dipakai apa adanya. Hanya rute ini yang menjalankan
 * Function (lihat public/_routes.json); halaman lain tetap aset statis.
 * Panduan lengkap: cloudflare/ADS-SWITCH.md.
 */
const FALSE_VALUES = /^(false|0|off|no)$/i;

export async function onRequestGet({ request, env }) {
  let config = {};
  try {
    const res = await env.ASSETS.fetch(new URL('/config.json', request.url));
    if (res.ok) config = await res.json();
  } catch {
    // config.json statis tidak ada/rusak: lanjut dengan objek kosong
  }

  try {
    if (env.MYPDF_FLAGS) {
      const value = await env.MYPDF_FLAGS.get('ADS_ENABLED', { cacheTtl: 60 });
      if (value !== null) config.adsEnabled = !FALSE_VALUES.test(value.trim());
    }
  } catch {
    // KV tidak tersedia: pakai nilai dari config.json statis
  }

  return new Response(JSON.stringify(config), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
