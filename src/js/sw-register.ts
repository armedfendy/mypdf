/**
 * Service Worker Registration
 * Registers the service worker to enable offline caching
 *
 * Note: Service Worker is disabled in development mode to prevent
 * conflicts with Vite's HMR (Hot Module Replacement)
 */

// Skip service worker registration in development mode
const isDevelopment =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.port !== '';

function collectTrustedWasmHosts(): string[] {
  const hosts = new Set<string>();
  const candidates = [
    import.meta.env.VITE_WASM_PYMUPDF_URL,
    import.meta.env.VITE_WASM_GS_URL,
    import.meta.env.VITE_WASM_CPDF_URL,
    import.meta.env.VITE_TESSERACT_WORKER_URL,
    import.meta.env.VITE_TESSERACT_CORE_URL,
    import.meta.env.VITE_TESSERACT_LANG_URL,
    import.meta.env.VITE_OCR_FONT_BASE_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).origin);
    } catch {
      console.warn(
        `[SW] Ignoring malformed VITE_* URL for SW trusted-hosts: ${raw}`
      );
    }
  }
  return Array.from(hosts);
}

function sendTrustedHostsToSw(target: ServiceWorker | null | undefined) {
  if (!target) return;
  const hosts = collectTrustedWasmHosts();
  if (hosts.length === 0) return;
  target.postMessage({ type: 'SET_TRUSTED_CDN_HOSTS', hosts });
}

// Pemberitahuan versi baru yang tidak memblokir halaman. SW sudah memanggil
// skipWaiting() sendiri, jadi halaman tidak di-reload paksa (pekerjaan
// pengguna yang sedang berjalan tidak hilang); reload hanya bila diklik.
function showUpdateToast(worker: ServiceWorker) {
  if (document.getElementById('sw-update-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'sw-update-toast';
  toast.setAttribute('role', 'status');
  toast.style.cssText =
    'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));' +
    'transform:translateX(-50%);z-index:9999;display:flex;align-items:center;' +
    'gap:12px;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;' +
    'border-radius:12px;background:#1f2937;color:#f9fafb;font-size:14px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.25)';

  const text = document.createElement('span');
  text.textContent = 'Versi baru mypdf.id tersedia.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Muat ulang';
  reload.style.cssText =
    'border:0;border-radius:8px;padding:6px 12px;background:#4f46e5;' +
    'color:#fff;font:inherit;font-weight:600;cursor:pointer';
  reload.addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Tutup');
  close.style.cssText =
    'border:0;background:transparent;color:inherit;font-size:20px;' +
    'line-height:1;padding:0 4px;cursor:pointer';
  close.addEventListener('click', () => toast.remove());

  toast.append(text, reload, close);
  document.body.appendChild(toast);
}

// Setelah deploy baru, chunk ber-hash dari build lama sudah dihapus dari
// Cloudflare Pages; tab lama yang memuat chunk dinamis akan gagal. Muat
// ulang sekali (dibatasi agar tidak berulang-ulang bila galatnya menetap).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'mypdf-preload-reload';
  try {
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

if (isDevelopment) {
  console.log('[Dev Mode] Service Worker registration skipped in development');
  console.log('Service Worker will be active in production builds');
} else if ('serviceWorker' in navigator) {
  // Registrasi (dan unduhan precache SW) ditunda sampai setelah frame
  // pertama tergambar agar tidak berebut jaringan dengan tampilan awal.
  const afterFirstPaint = (fn: () => void) =>
    window.addEventListener('load', () =>
      requestAnimationFrame(() => setTimeout(fn, 0))
    );
  afterFirstPaint(() => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    console.log('[SW] Registering Service Worker at:', swPath);
    navigator.serviceWorker
      .register(swPath)
      .then((registration) => {
        console.log(
          '[SW] Service Worker registered successfully:',
          registration.scope
        );

        sendTrustedHostsToSw(
          registration.active || registration.waiting || registration.installing
        );

        setInterval(
          () => {
            registration.update();
          },
          24 * 60 * 60 * 1000
        );

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                sendTrustedHostsToSw(newWorker);
              }
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                console.log('[SW] New version available! Reload to update.');
                showUpdateToast(newWorker);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });

    navigator.serviceWorker.ready.then((registration) => {
      sendTrustedHostsToSw(registration.active);
    });
  });
}
