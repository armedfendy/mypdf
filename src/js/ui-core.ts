// Bagian ringan dari ui.ts (DOM, loader, alert, pergantian tampilan) tanpa
// dependensi berat seperti pdfjs-dist dan sortablejs, agar main.ts yang
// dimuat di semua halaman tidak ikut menarik pustaka alat PDF.
import { resetState } from './state.js';
import { t } from './i18n/i18n';
import {
  showSuccessAdSlot,
  hideSuccessAdSlot,
  refreshPageAdSlots,
} from './ads.js';

// Centralizing DOM element selection
export const dom = {
  gridView: document.getElementById('grid-view'),
  toolGrid: document.getElementById('tool-grid'),
  toolInterface: document.getElementById('tool-interface'),
  toolContent: document.getElementById('tool-content'),
  backToGridBtn: document.getElementById('back-to-grid'),
  loaderModal: document.getElementById('loader-modal'),
  loaderText: document.getElementById('loader-text'),
  alertModal: document.getElementById('alert-modal'),
  alertTitle: document.getElementById('alert-title'),
  alertMessage: document.getElementById('alert-message'),
  alertOkBtn: document.getElementById('alert-ok'),
  heroSection: document.getElementById('hero-section'),
  featuresSection: document.getElementById('features-section'),
  toolsHeader: document.getElementById('tools-header'),
  dividers: document.querySelectorAll('.section-divider'),
  hideSections: document.querySelectorAll('.hide-section'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsModalBtn: document.getElementById('close-shortcuts-modal'),
  shortcutsList: document.getElementById('shortcuts-list'),
  shortcutSearch: document.getElementById('shortcut-search'),
  resetShortcutsBtn: document.getElementById('reset-shortcuts-btn'),
  importShortcutsBtn: document.getElementById('import-shortcuts-btn'),
  exportShortcutsBtn: document.getElementById('export-shortcuts-btn'),
  openShortcutsBtn: document.getElementById('open-shortcuts-btn'),
  warningModal: document.getElementById('warning-modal'),
  warningTitle: document.getElementById('warning-title'),
  warningMessage: document.getElementById('warning-message'),
  warningCancelBtn: document.getElementById('warning-cancel-btn'),
  warningConfirmBtn: document.getElementById('warning-confirm-btn'),
};

export const showLoader = (text = t('common.loading'), progress?: number) => {
  if (dom.loaderText) dom.loaderText.textContent = text;

  // Add or update progress bar if progress is provided
  const loaderModal = dom.loaderModal;
  if (loaderModal) {
    let progressBar = loaderModal.querySelector(
      '.loader-progress-bar'
    ) as HTMLElement;
    let progressContainer = loaderModal.querySelector(
      '.loader-progress-container'
    ) as HTMLElement;

    if (progress !== undefined && progress >= 0) {
      // Create progress container if it doesn't exist
      if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'loader-progress-container w-64 mt-4';
        progressContainer.innerHTML = `
                    <div class="bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div class="loader-progress-bar bg-indigo-500 h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p class="loader-progress-text text-xs text-gray-400 mt-1 text-center">0%</p>
                `;
        loaderModal
          .querySelector('.bg-gray-800')
          ?.appendChild(progressContainer);
        progressBar = progressContainer.querySelector(
          '.loader-progress-bar'
        ) as HTMLElement;
      }

      // Update progress
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      const progressText = progressContainer.querySelector(
        '.loader-progress-text'
      );
      if (progressText) {
        progressText.textContent = `${Math.round(progress)}%`;
      }
      progressContainer.classList.remove('hidden');
    } else {
      // Hide progress bar if no progress provided
      if (progressContainer) {
        progressContainer.classList.add('hidden');
      }
    }

    loaderModal.classList.remove('hidden');
  }
};

export const hideLoader = () => {
  if (dom.loaderModal) dom.loaderModal.classList.add('hidden');
};

export const showAlert = (
  title: string,
  message: string,
  type: string = 'error',
  callback?: () => void
) => {
  if (dom.alertTitle) dom.alertTitle.textContent = title;
  if (dom.alertMessage) dom.alertMessage.textContent = message;
  if (dom.alertModal) dom.alertModal.classList.remove('hidden');

  if (type === 'success') {
    showSuccessAdSlot();
  } else {
    hideSuccessAdSlot();
  }

  if (dom.alertOkBtn) {
    const newOkBtn = dom.alertOkBtn.cloneNode(true) as HTMLElement;
    dom.alertOkBtn.replaceWith(newOkBtn);
    dom.alertOkBtn = newOkBtn;

    newOkBtn.addEventListener('click', () => {
      hideAlert();
      if (type === 'success') {
        // Muat ulang 2 slot iklan halaman via AJAX (tanpa reload) saat
        // pengguna kembali ke tampilan awal alat setelah proses selesai.
        refreshPageAdSlots();
      }
      if (callback) callback();
    });
  }
};

export const hideAlert = () => {
  if (dom.alertModal) dom.alertModal.classList.add('hidden');
};

export const switchView = (view: string) => {
  if (view === 'grid') {
    dom.gridView.classList.remove('hidden');
    dom.toolInterface.classList.add('hidden');
    // show hero and features and header
    dom.heroSection.classList.remove('hidden');
    dom.featuresSection.classList.remove('hidden');
    dom.toolsHeader.classList.remove('hidden');
    // show dividers
    dom.dividers.forEach((divider) => {
      divider.classList.remove('hidden');
    });
    // show hideSections
    dom.hideSections.forEach((section) => {
      section.classList.remove('hidden');
    });

    resetState();
  } else {
    dom.gridView.classList.add('hidden');
    dom.toolInterface.classList.remove('hidden');
    dom.featuresSection.classList.add('hidden');
    dom.heroSection.classList.add('hidden');
    dom.toolsHeader.classList.add('hidden');
    dom.dividers.forEach((divider) => {
      divider.classList.add('hidden');
    });
    dom.hideSections.forEach((section) => {
      section.classList.add('hidden');
    });
  }
};
