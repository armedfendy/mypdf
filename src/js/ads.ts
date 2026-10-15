// Integrasi slot iklan Adsterra.
//
// Kode slot asli (skrip/markup dari dashboard Adsterra) belum tersedia --
// menunggu Fase 1 di _local/plan/rencana-adsterra.md (akun + kode slot).
// renderAdCreative() di bawah adalah satu-satunya tempat kode itu nanti
// dipasang; jangan menebak domain/skrip pihak ketiga di sini sebelum kode
// slot sebenarnya didapat (lihat juga Fase 3e soal pelonggaran CSP).

const PAGE_AD_SLOT_IDS = ['ad-slot-top', 'ad-slot-bottom'] as const;
const SUCCESS_AD_SLOT_ID = 'alert-ad-slot';

function renderAdCreative(_el: HTMLElement, _slotId: string): void {
  // TODO(Adsterra Fase 1): ganti isi fungsi ini dengan kode slot asli.
  // - #ad-slot-top dan #alert-ad-slot: format Banner.
  // - #ad-slot-bottom: format Native Banner.
  // loadSlot() sudah mengosongkan elemen sebelum memanggil fungsi ini,
  // jadi aman untuk innerHTML/appendChild kode slot di sini.
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
 * alat setelah modal sukses ditutup (lihat showAlert() di ui.ts).
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
