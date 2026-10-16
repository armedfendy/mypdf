import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Node 25 punya localStorage bawaan yang menimpa milik jsdom dan tidak
// berfungsi tanpa --localstorage-file; pakai penyimpanan di memori.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('persetujuan cookie iklan (consent.ts)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    document.body.innerHTML = '';
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('belum memilih: getAdsConsent null dan banner bisa ditampilkan', async () => {
    const c = await import('../js/consent');
    expect(c.getAdsConsent()).toBeNull();
    c.showConsentBanner();
    const banner = document.querySelector('.mp-consent') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('a')?.getAttribute('href')).toBe(
      '/privacy#iklan'
    );
  });

  it('Terima menyimpan pilihan, memberi tahu listener, dan menutup banner', async () => {
    const c = await import('../js/consent');
    const seen: string[] = [];
    c.onAdsConsentChange((v) => seen.push(v));
    c.showConsentBanner();
    const buttons = [...document.querySelectorAll('.mp-consent-btn')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Tolak', 'Terima']);
    (buttons[1] as HTMLButtonElement).click();
    expect(c.getAdsConsent()).toBe('granted');
    expect(seen).toEqual(['granted']);
    expect((document.querySelector('.mp-consent') as HTMLElement).hidden).toBe(
      true
    );
  });

  it('Tolak tersimpan sebagai denied', async () => {
    const c = await import('../js/consent');
    c.showConsentBanner();
    (document.querySelectorAll('.mp-consent-btn')[0] as HTMLElement).click();
    expect(c.getAdsConsent()).toBe('denied');
  });

  it('versi persetujuan lama atau nilai rusak dianggap belum memilih', async () => {
    localStorage.setItem(
      'mypdf-ads-consent',
      JSON.stringify({ v: 0, c: 'granted' })
    );
    let c = await import('../js/consent');
    expect(c.getAdsConsent()).toBeNull();
    localStorage.setItem('mypdf-ads-consent', '{rusak');
    vi.resetModules();
    c = await import('../js/consent');
    expect(c.getAdsConsent()).toBeNull();
  });

  it('[data-cookie-settings] membuka banner lagi', async () => {
    const c = await import('../js/consent');
    c.bindCookieSettings();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button data-cookie-settings>Pengaturan Cookie</button>'
    );
    (document.querySelector('[data-cookie-settings]') as HTMLElement).click();
    expect(document.querySelector('.mp-consent')).not.toBeNull();
  });
});
