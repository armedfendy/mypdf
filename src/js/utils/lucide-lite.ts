// createIcons ringan untuk modul yang dimuat di semua halaman.
//
// createIcons bawaan didefinisikan di modul utama 'lucide', yang juga membuat
// namespace `icons` berisi seluruh koleksi. Karena halaman alat memakai
// namespace itu, mengimpor apa pun dari 'lucide' membuat seluruh koleksi
// (±83 KiB gzip) ikut termuat. Modul ini memakai replaceElement dan berkas
// ikon secara langsung (lihat lucide-icons.ts) agar beranda tidak menariknya.
import type { IconNode } from 'lucide';
import replaceElement from 'lucide/dist/esm/replaceElement.js';

export function createIcons({
  icons,
  root = document,
  attrs = {},
  nameAttr = 'data-lucide',
}: {
  icons: Record<string, IconNode>;
  root?: Document | Element | DocumentFragment;
  attrs?: Record<string, string>;
  nameAttr?: string;
}): void {
  root
    .querySelectorAll(`[${nameAttr}]`)
    .forEach((element) => replaceElement(element, { nameAttr, icons, attrs }));
}
