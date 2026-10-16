# Saklar iklan tanpa build ulang (Cloudflare KV)

Iklan Adsterra di mypdf.id bisa dimatikan atau dinyalakan dari dasbor
Cloudflare tanpa build dan tanpa deploy. Perubahan berlaku dalam sekitar
1 menit untuk pengunjung yang membuka atau memuat ulang halaman.

## Cara kerja

- `functions/config.json.js` (Cloudflare Pages Function) melayani
  `/config.json`. Isinya adalah `public/config.json` yang digabung dengan
  kunci `ADS_ENABLED` dari KV.
- `src/js/ads.ts` tidak memuat iklan bila `adsEnabled` bernilai `false`.
- `public/_routes.json` membatasi Function hanya ke `/config.json`, jadi
  halaman lain tetap disajikan sebagai berkas statis (tanpa biaya Function).
- Bila binding atau kunci belum ada, atau KV gagal dibaca, isi
  `public/config.json` dipakai apa adanya. Situs tidak rusak.

## Pengaturan awal (sekali saja)

1. Dasbor Cloudflare > **Storage & Databases** > **KV** (atau **Workers & Pages > KV**)
   > **Create namespace**. Nama bebas, misalnya `mypdf-flags`.
2. Buka namespace itu > **KV Pairs** > tambahkan:
   - Key: `ADS_ENABLED`
   - Value: `true`
3. **Workers & Pages** > proyek Pages mypdf > **Settings** > **Bindings** >
   **Add** > **KV namespace**:
   - Variable name: `MYPDF_FLAGS` (harus persis)
   - KV namespace: `mypdf-flags`
     Tambahkan untuk **Production** dan juga **Preview** (server dev).
4. Lakukan satu kali deploy ulang (mis. **Deployments** > **Retry deployment**)
   agar binding terpasang. Setelah ini, mengubah nilai KV tidak perlu deploy.

## Mematikan / menyalakan iklan

Dasbor Cloudflare > KV > `mypdf-flags` > **KV Pairs** > edit `ADS_ENABLED`:

| Nilai                           | Hasil                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `false` (atau `0`, `off`, `no`) | Iklan tidak dimuat                                                  |
| `true`                          | Iklan dimuat (setelah pengunjung menekan Terima pada banner cookie) |
| kunci dihapus                   | Mengikuti `public/config.json`                                      |

## Memeriksa

Buka `https://<domain>/config.json`. Bila iklan dimatikan, hasilnya memuat
`"adsEnabled":false`.

Catatan: build tanpa iklan sama sekali (tanpa kode iklan di bundle) tetap
tersedia lewat `npm run build:mypdf:noads`.
