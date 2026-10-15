// Integrasi slot iklan Adsterra.
//
// Format "Banner" Adsterra memakai document.write() lewat invoke.js, dengan
// konfigurasi lewat variabel GLOBAL window.atOptions. Karena ada lebih dari
// satu slot Banner di halaman yang sama (atas + modal), atOptions akan
// saling menimpa bila dimuat langsung di dokumen utama -- slot kedua akan
// membuat slot pertama rusak/kosong. Solusinya: setiap slot dirender di
// dalam <iframe srcdoc> sendiri, sehingga atOptions dan document.write
// masing-masing terisolasi di window iframe-nya sendiri. Ini juga membuat
// refresh (refreshPageAdSlots) aman: iframe lama diganti dengan yang baru,
// bukan menjalankan ulang document.write di dokumen utama (yang berisiko
// menghapus seluruh isi halaman).
//
interface BannerAdConfig {
  key: string;
  width: number;
  height: number;
}

// Domain & key unit Banner dari dashboard Adsterra (dicek 2026-10-15).
const AD_SCRIPT_HOST = 'www.highrevenueformat.com';

const BANNER_DESKTOP: BannerAdConfig = {
  key: 'cb9519efa134a074c24729247bd01d28',
  width: 728,
  height: 90,
};
const BANNER_MOBILE: BannerAdConfig = {
  key: '18e6b47cdb4a2baf20786ac4c6e68b1a',
  width: 320,
  height: 50,
};
const BANNER_MODAL: BannerAdConfig = {
  key: 'eed0030c47d35648d0bbc0f7431e3569',
  width: 300,
  height: 250,
};

// Unit Native Banner (4:1, font-size/color inherit). Format ini tidak
// memakai atOptions/document.write -- cukup skrip async yang mencari div
// dengan id ini dan merender kreatifnya di situ, jadi aman dirender
// langsung di dokumen utama (tidak perlu isolasi iframe seperti Banner).
const NATIVE_BANNER = {
  containerId: 'container-b1d6750fe7f7752de90a6bd2ce41ec96',
  scriptSrc:
    'https://pl31840967.profitableratecpmnetwork.com/b1d6750fe7f7752de90a6bd2ce41ec96/invoke.js',
};

const MOBILE_MEDIA_QUERY = '(max-width: 640px)';
const PAGE_AD_SLOT_IDS = ['ad-slot-top', 'ad-slot-bottom'] as const;
const SUCCESS_AD_SLOT_ID = 'alert-ad-slot';

function bannerIframeDoc(cfg: BannerAdConfig): string {
  const atOptions = JSON.stringify({
    key: cfg.key,
    format: 'iframe',
    height: cfg.height,
    width: cfg.width,
    params: {},
  });
  return (
    '<!DOCTYPE html><html><head><style>' +
    'body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;}' +
    '</style></head><body>' +
    `<script>atOptions=${atOptions};</script>` +
    `<script src="//${AD_SCRIPT_HOST}/${cfg.key}/invoke.js"></script>` +
    '</body></html>'
  );
}

function renderBanner(el: HTMLElement, cfg: BannerAdConfig): void {
  const iframe = document.createElement('iframe');
  iframe.srcdoc = bannerIframeDoc(cfg);
  iframe.width = String(cfg.width);
  iframe.height = String(cfg.height);
  iframe.style.border = '0';
  iframe.style.maxWidth = '100%';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('loading', 'lazy');
  iframe.title = 'Iklan';
  el.appendChild(iframe);
}

function renderTopBanner(el: HTMLElement): void {
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  renderBanner(el, isMobile ? BANNER_MOBILE : BANNER_DESKTOP);
}

function renderNativeBanner(el: HTMLElement): void {
  const container = document.createElement('div');
  container.id = NATIVE_BANNER.containerId;
  el.appendChild(container);

  const script = document.createElement('script');
  script.async = true;
  script.dataset.cfasync = 'false';
  script.src = NATIVE_BANNER.scriptSrc;
  el.appendChild(script);
}

function renderAdCreative(el: HTMLElement, slotId: string): void {
  if (slotId === 'ad-slot-top') {
    renderTopBanner(el);
  } else if (slotId === SUCCESS_AD_SLOT_ID) {
    renderBanner(el, BANNER_MODAL);
  } else if (slotId === 'ad-slot-bottom') {
    renderNativeBanner(el);
  }
}

function loadSlot(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  renderAdCreative(el, id);
}

/** Dipanggil sekali saat halaman selesai dimuat. */
export function initPageAdSlots(): void {
  PAGE_AD_SLOT_IDS.forEach(loadSlot);
}

/**
 * Muat ulang kedua slot iklan halaman (bukan slot di dalam modal) lewat
 * AJAX/SPA, tanpa reload. Dipanggil saat pengguna kembali ke tampilan awal
 * alat setelah modal sukses ditutup (lihat showAlert() di ui.ts). Aman
 * dipanggil berkali-kali karena tiap slot diisi ulang lewat iframe baru.
 */
export function refreshPageAdSlots(): void {
  PAGE_AD_SLOT_IDS.forEach(loadSlot);
}

/** Tampilkan dan muat slot iklan di dalam modal alert (hanya untuk sukses). */
export function showSuccessAdSlot(): void {
  const el = document.getElementById(SUCCESS_AD_SLOT_ID);
  if (!el) return;
  el.classList.remove('hidden');
  loadSlot(SUCCESS_AD_SLOT_ID);
}

/** Sembunyikan dan kosongkan slot iklan modal (untuk alert non-sukses). */
export function hideSuccessAdSlot(): void {
  const el = document.getElementById(SUCCESS_AD_SLOT_ID);
  if (!el) return;
  el.classList.add('hidden');
  el.innerHTML = '';
}
