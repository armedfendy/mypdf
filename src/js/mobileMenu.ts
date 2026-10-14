import './searchPalette.js';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

document.addEventListener('DOMContentLoaded', () => {
  const installBanner = document.getElementById('install-banner');
  if (installBanner) {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('mypdf-install-dismissed') === '1';
    } catch {
      dismissed = false;
    }
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      if (dismissed) return;
      const deferred = event as InstallPromptEvent;
      installBanner.hidden = false;
      document
        .getElementById('install-accept')
        ?.addEventListener('click', async () => {
          installBanner.hidden = true;
          await deferred.prompt();
        });
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

  const heroSearch = document.getElementById(
    'hero-search'
  ) as HTMLInputElement | null;
  heroSearch?.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    document.getElementById('tools-header')?.scrollIntoView();
  });

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
