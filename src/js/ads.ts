// Integrasi slot iklan Adsterra.
//
// Setiap slot dirender sebagai <iframe sandbox> ke /ads/frame.html?slot=...,
// halaman milik situs yang berisi kode unit Adsterra. Alasannya:
// - Adsterra memuat kreatif dari domain yang berganti-ganti. Dengan srcdoc
//   (sebelumnya) iframe mewarisi CSP halaman utama, sehingga iklan dari domain
//   yang tidak ada di daftar terblokir dan slot kadang tampil kosong/rusak.
//   /ads/frame.html punya CSP longgar sendiri; CSP halaman utama tetap ketat.
// - sandbox tanpa allow-same-origin: iklan berjalan di origin "null", tidak
//   bisa membaca localStorage/cookie situs. Tanpa allow-top-navigation: iklan
//   tidak bisa mengalihkan halaman. allow-popups agar klik iklan membuka tab.
// - atOptions/document.write Banner tetap terisolasi per slot, dan refresh
//   aman karena iframe lama diganti dengan yang baru.
//
// Frame mengirim { type: 'mp-ad', height } dan { type: 'mp-ad', empty: true };
// slot tanpa iklan (no-fill/terblokir) disembunyikan, bukan tampil kosong.
//
import {
  areAdsEnabledAtRuntime,
  loadRuntimeConfig,
} from './utils/disabled-tools.js';

// Saklar iklan:
// 1. Build: VITE_ADS_ENABLED=true (aktif di `build:mypdf`; `build:mypdf:noads`
//    membuat build tanpa iklan).
// 2. Runtime: "adsEnabled": false di public/config.json (atau config.json di
//    server) mematikan iklan seketika tanpa build ulang, mis. bila iklan
//    ilegal muncul. config.json diambil dengan cache: 'no-cache'.
// Halaman ber-COEP (crossOriginIsolated, mis. konversi Office) tidak memuat
// iklan: browser memblokir iframe pihak ketiga di dalamnya.
const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === 'true';
const adsActive = () =>
  ADS_ENABLED && areAdsEnabledAtRuntime() && !window.crossOriginIsolated;

// Cloudflare Pages mengalihkan /ads/frame.html ke /ads/frame (308); di
// produksi langsung pakai URL tanpa ekstensi agar tidak ada round-trip ekstra.
const FRAME_URL = `${import.meta.env.BASE_URL}ads/${
  import.meta.env.DEV ? 'frame.html' : 'frame'
}`;
const FRAME_SANDBOX =
  'allow-scripts allow-popups allow-popups-to-escape-sandbox';
const MOBILE_MEDIA_QUERY = '(max-width: 640px)';
const PAGE_AD_SLOT_IDS = ['ad-slot-top', 'ad-slot-bottom'] as const;
const SUCCESS_AD_SLOT_ID = 'alert-ad-slot';

interface FrameSpec {
  slot: string;
  width: number | '100%';
  height: number;
}

function frameSpecFor(slotId: string): FrameSpec | null {
  if (slotId === 'ad-slot-top') {
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches
      ? { slot: 'top-mobile', width: 320, height: 50 }
      : { slot: 'top-desktop', width: 728, height: 90 };
  }
  if (slotId === SUCCESS_AD_SLOT_ID) {
    return { slot: 'modal', width: 300, height: 250 };
  }
  if (slotId === 'ad-slot-bottom') {
    // Tinggi Native Banner bergantung kreatif; disesuaikan lewat pesan frame.
    // Tinggi awal 1 px: iframe lazy setinggi 0 bisa tidak pernah dimuat.
    return { slot: 'native', width: '100%', height: 1 };
  }
  return null;
}

// iframe aktif -> elemen slot, untuk mencocokkan event.source pesan frame.
const activeFrames = new Map<
  Window,
  { el: HTMLElement; iframe: HTMLIFrameElement }
>();

function hideSlot(el: HTMLElement): void {
  el.innerHTML = '';
  if (el.id === SUCCESS_AD_SLOT_ID) el.classList.add('hidden');
  else el.classList.remove('mp-ad-slot--on');
}

window.addEventListener('message', (event) => {
  const data = event.data as {
    type?: string;
    height?: number;
    empty?: boolean;
  };
  if (!data || data.type !== 'mp-ad' || !event.source) return;
  const entry = activeFrames.get(event.source as Window);
  if (!entry) return;
  if (data.empty) {
    activeFrames.delete(event.source as Window);
    hideSlot(entry.el);
  } else if (typeof data.height === 'number' && data.height > 0) {
    entry.iframe.style.height = `${Math.min(data.height, 1200)}px`;
  }
});

function renderFrame(el: HTMLElement, spec: FrameSpec): void {
  for (const [win, entry] of activeFrames) {
    if (entry.el === el) activeFrames.delete(win);
  }
  const label = document.createElement('span');
  label.className = 'mp-ad-label';
  label.textContent = 'Iklan';

  const iframe = document.createElement('iframe');
  iframe.src = `${FRAME_URL}?slot=${spec.slot}`;
  iframe.setAttribute('sandbox', FRAME_SANDBOX);
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.title = 'Iklan';
  iframe.style.border = '0';
  iframe.style.maxWidth = '100%';
  iframe.style.width = spec.width === '100%' ? '100%' : `${spec.width}px`;
  iframe.style.height = `${spec.height}px`;

  el.append(label, iframe);
  if (iframe.contentWindow) {
    activeFrames.set(iframe.contentWindow, { el, iframe });
  }
}

function loadSlot(id: string): void {
  if (!adsActive()) return;
  const el = document.getElementById(id);
  const spec = frameSpecFor(id);
  if (!el || !spec) return;
  el.classList.add('mp-ad-slot--on');
  el.innerHTML = '';
  renderFrame(el, spec);
}

/** Dipanggil sekali saat halaman selesai dimuat. */
export async function initPageAdSlots(): Promise<void> {
  if (!ADS_ENABLED) return;
  // Biasanya sudah dimuat oleh init() di main.ts; dipanggil lagi di sini agar
  // saklar runtime tetap berlaku bila urutan pemanggilan berubah.
  await loadRuntimeConfig();
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
  if (!adsActive()) return;
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

// Slot iklan sukses untuk halaman alat tanpa alert-modal bersama (mis.
// json-to-pdf, pdf-multi-tool, form-creator, bookmark, add-stamps) yang
// memakai pesan status atau modal sendiri. Satu slot per halaman, disisipkan
// tepat setelah elemen pesan sukses; memakai unit dan iframe sandbox yang sama
// dengan slot di alert-modal.
const INLINE_SUCCESS_AD_ID = 'mp-inline-success-ad';

/** Tampilkan iklan sukses tepat setelah `anchor` (pesan/elemen sukses). */
export function showInlineSuccessAd(anchor: Element | null): void {
  if (!anchor || !adsActive()) return;
  let el = document.getElementById(INLINE_SUCCESS_AD_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = INLINE_SUCCESS_AD_ID;
    el.className = 'mp-ad-slot';
  }
  anchor.insertAdjacentElement('afterend', el);
  el.classList.add('mp-ad-slot--on');
  el.innerHTML = '';
  renderFrame(el, { slot: 'modal', width: 300, height: 250 });
}

/** Sembunyikan iklan sukses inline (mis. saat pesan berganti ke error). */
export function hideInlineSuccessAd(): void {
  const el = document.getElementById(INLINE_SUCCESS_AD_ID);
  if (el) hideSlot(el);
}
