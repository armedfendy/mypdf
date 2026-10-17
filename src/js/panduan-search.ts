// Kotak pencarian di halaman indeks /panduan/ (dibuat scripts/generate-panduan.mjs).
// Menyaring kartu artikel di sisi klien berdasarkan atribut data-search
// (judul, ringkasan, subjudul, pertanyaan FAQ). Kata kunci disimpan di ?q=
// agar hasil pencarian bisa dibagikan dan tetap ada saat tombol Kembali.

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function init(): void {
  const input = document.getElementById(
    'panduan-search'
  ) as HTMLInputElement | null;
  const list = document.getElementById('panduan-list');
  const countEl = document.getElementById('panduan-search-count');
  const emptyEl = document.getElementById('panduan-search-empty');
  if (!input || !list) return;

  const cards = Array.from(
    list.querySelectorAll<HTMLAnchorElement>('a[data-search]')
  ).map((el) => ({
    el,
    text: normalize(`${el.textContent ?? ''} ${el.dataset.search ?? ''}`),
  }));

  const apply = () => {
    const words = normalize(input.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const card of cards) {
      const match = words.every((w) => card.text.includes(w));
      card.el.style.display = match ? '' : 'none';
      if (match) shown++;
    }
    if (countEl) {
      countEl.textContent = words.length
        ? `${shown} dari ${cards.length} panduan`
        : '';
    }
    if (emptyEl) emptyEl.hidden = shown > 0;

    const url = new URL(window.location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  };

  input.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    apply();
  });
  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      apply();
    }
  });

  const q = new URLSearchParams(window.location.search).get('q');
  if (q) {
    input.value = q;
    apply();
  }

  // "/" memfokuskan kotak pencarian, kecuali saat sedang mengetik di kolom lain.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    )
      return;
    e.preventDefault();
    input.focus();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
