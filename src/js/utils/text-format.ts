// Helper teks murni tanpa dependensi, dipakai main.ts di semua halaman.
// helpers.ts me-re-export semuanya agar impor lama tetap berlaku.

/**
 * Escape HTML special characters to prevent XSS
 * @param text - The text to escape
 * @returns The escaped text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function formatStars(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function formatShortcutDisplay(
  shortcut: string,
  isMac: boolean
): string {
  if (!shortcut) return '';
  return shortcut
    .replace('mod', isMac ? '⌘' : 'Ctrl')
    .replace('ctrl', isMac ? '^' : 'Ctrl') // Control key on Mac shows as ^
    .replace('alt', isMac ? '⌥' : 'Alt')
    .replace('shift', 'Shift')
    .split('+')
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(isMac ? '' : '+');
}
