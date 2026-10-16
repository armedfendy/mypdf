// Persetujuan cookie iklan mypdf.id.
//
// Iklan Adsterra dapat memakai cookie pihak ketiga, jadi iklan baru dimuat
// setelah pengunjung menekan "Terima" (lihat ads.ts). "Tolak" berarti iklan
// tidak dimuat sama sekali; Adsterra tidak punya mode iklan tanpa cookie.
// Cloudflare Web Analytics tidak memakai cookie sehingga tidak bergantung pada
// persetujuan ini. Pilihan disimpan di localStorage dan bisa diubah lewat
// elemen ber-atribut data-cookie-settings (footer dan halaman Privasi).
import { getStoredItem, setStoredItem } from './utils/safe-storage.js';

export type AdsConsent = 'granted' | 'denied';

const STORAGE_KEY = 'mypdf-ads-consent';
// Naikkan bila isi pemberitahuan berubah berarti, agar pengunjung ditanya ulang.
const CONSENT_VERSION = 1;

const listeners: Array<(consent: AdsConsent) => void> = [];
let banner: HTMLElement | null = null;
let settingsBound = false;

export function getAdsConsent(): AdsConsent | null {
  try {
    const saved = JSON.parse(getStoredItem(STORAGE_KEY) || 'null') as {
      v?: number;
      c?: string;
    } | null;
    if (
      saved &&
      saved.v === CONSENT_VERSION &&
      (saved.c === 'granted' || saved.c === 'denied')
    ) {
      return saved.c;
    }
  } catch {
    // nilai rusak: anggap belum memilih
  }
  return null;
}

export function onAdsConsentChange(fn: (consent: AdsConsent) => void): void {
  listeners.push(fn);
}

function setAdsConsent(consent: AdsConsent): void {
  setStoredItem(
    STORAGE_KEY,
    JSON.stringify({
      v: CONSENT_VERSION,
      c: consent,
      t: new Date().toISOString(),
    })
  );
  listeners.forEach((fn) => fn(consent));
}

function buildBanner(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mp-consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Persetujuan cookie');

  const text = document.createElement('p');
  text.className = 'mp-consent-text';
  text.append(
    'Untuk menjaga mypdf.id tetap gratis, kami menampilkan iklan dari ' +
      'jaringan Adsterra yang dapat menggunakan cookie pihak ketiga. Iklan ' +
      'hanya dimuat jika Anda menyetujuinya, dan file Anda tetap tidak ' +
      'pernah diunggah. '
  );
  const link = document.createElement('a');
  link.href = '/privacy#iklan';
  link.textContent = 'Kebijakan Privasi';
  text.append(link, '.');

  const actions = document.createElement('div');
  actions.className = 'mp-consent-actions';
  // Kedua tombol sengaja setara secara visual agar menolak semudah menerima.
  for (const [consent, label] of [
    ['denied', 'Tolak'],
    ['granted', 'Terima'],
  ] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mp-consent-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      el.hidden = true;
      setAdsConsent(consent);
    });
    actions.append(btn);
  }

  el.append(text, actions);
  document.body.append(el);
  return el;
}

export function showConsentBanner(): void {
  banner ??= buildBanner();
  banner.hidden = false;
}

/** Hubungkan tombol/tautan [data-cookie-settings] agar membuka banner lagi. */
export function bindCookieSettings(): void {
  if (settingsBound) return;
  settingsBound = true;
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest?.(
      '[data-cookie-settings]'
    );
    if (!target) return;
    event.preventDefault();
    showConsentBanner();
  });
}
