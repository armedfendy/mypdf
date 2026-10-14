import '@phosphor-icons/web/regular';
import './searchPalette.js';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar: kelompok menu bisa dilipat, halaman aktif ditandai, laci di HP.
  const sideNav = document.getElementById('mp-side-nav');
  if (sideNav) {
    sideNav.addEventListener('click', (event) => {
      const head = (event.target as HTMLElement).closest('.mp-grp-head');
      if (!head) return;
      const expanded = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!expanded));
      const body = head.nextElementSibling as HTMLElement | null;
      if (body) body.hidden = expanded;
    });

    const path =
      window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    sideNav
      .querySelectorAll<HTMLAnchorElement>('a.mp-side-link')
      .forEach((a) => {
        const href = a.getAttribute('href') || '';
        const target = href.replace(/\/$/, '') || '/';
        if (!href.startsWith('/') || target !== path) return;
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      });
    const current = sideNav.querySelector<HTMLElement>(
      'a.is-active:not(.mp-side-home)'
    );
    if (current && window.matchMedia('(min-width: 1024px)').matches) {
      sideNav.scrollTop = Math.max(
        0,
        current.offsetTop - sideNav.clientHeight / 2
      );
    }
  }

  const drawerBtn = document.getElementById('mobile-menu-button');
  const setDrawer = (open: boolean) => {
    document.body.classList.toggle('mp-drawer-open', open);
    drawerBtn?.setAttribute('aria-expanded', String(open));
  };
  drawerBtn?.addEventListener('click', () =>
    setDrawer(!document.body.classList.contains('mp-drawer-open'))
  );
  document
    .querySelectorAll('[data-drawer-close]')
    .forEach((el) => el.addEventListener('click', () => setDrawer(false)));
  sideNav?.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) setDrawer(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setDrawer(false);
  });

  const installBanner = document.getElementById('install-banner');
  if (installBanner) {
    let dismissed: boolean;
    try {
      dismissed = localStorage.getItem('mypdf-install-dismissed') === '1';
    } catch {
      dismissed = false;
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) installBanner.hidden = true;

    let deferred: InstallPromptEvent | null = null;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferred = event as InstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
      installBanner.hidden = true;
    });

    document
      .getElementById('install-accept')
      ?.addEventListener('click', async () => {
        if (deferred) {
          const prompt = deferred;
          deferred = null;
          await prompt.prompt();
          return;
        }
        // Browser tidak menyediakan dialog pasang otomatis: tampilkan petunjuk.
        const sub = document.getElementById('install-sub');
        if (sub) {
          const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
          sub.textContent = ios
            ? 'Ketuk Bagikan, lalu pilih "Tambah ke Layar Utama".'
            : 'Buka menu browser, lalu pilih "Pasang aplikasi" atau "Tambahkan ke layar utama".';
        }
      });

    document
      .getElementById('install-dismiss')
      ?.addEventListener('click', () => {
        installBanner.hidden = true;
        try {
          localStorage.setItem('mypdf-install-dismissed', '1');
        } catch {
          /* abaikan */
        }
      });
  }

  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');

  if (mobileMenuButton && mobileMenu && menuIcon && closeIcon) {
    // Toggle menu on button click
    mobileMenuButton.addEventListener('click', () => {
      const isExpanded =
        mobileMenuButton.getAttribute('aria-expanded') === 'true';

      // Toggle menu visibility
      mobileMenu.classList.toggle('hidden');

      // Toggle icons
      menuIcon.classList.toggle('hidden');
      closeIcon.classList.toggle('hidden');

      // Update aria-expanded for accessibility
      mobileMenuButton.setAttribute('aria-expanded', (!isExpanded).toString());
    });

    // Close menu when clicking on a link
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as Node;
      const isClickInsideMenu = mobileMenu.contains(target);
      const isClickOnButton = mobileMenuButton.contains(target);

      if (
        !isClickInsideMenu &&
        !isClickOnButton &&
        !mobileMenu.classList.contains('hidden')
      ) {
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const mobileProductsButton = document.getElementById(
    'mobile-products-button'
  );
  const mobileProductsMenu = document.getElementById('mobile-products-menu');

  if (mobileProductsButton && mobileProductsMenu) {
    mobileProductsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen =
        mobileProductsButton.getAttribute('aria-expanded') === 'true';
      mobileProductsMenu.hidden = isOpen;
      mobileProductsButton.setAttribute('aria-expanded', (!isOpen).toString());
    });
  }

  const productsButton = document.getElementById('products-menu-button');
  const productsMenu = document.getElementById('products-menu');

  if (productsButton && productsMenu) {
    const closeProducts = () => {
      productsMenu.hidden = true;
      productsButton.setAttribute('aria-expanded', 'false');
    };

    productsButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = productsButton.getAttribute('aria-expanded') === 'true';
      productsMenu.hidden = isOpen;
      productsButton.setAttribute('aria-expanded', (!isOpen).toString());
    });

    document.addEventListener('click', (event) => {
      const target = event.target as Node;
      if (!productsMenu.contains(target) && !productsButton.contains(target)) {
        closeProducts();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !productsMenu.hidden) {
        closeProducts();
        productsButton.focus();
      }
    });
  }
});
