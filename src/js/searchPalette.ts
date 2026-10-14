// Modal pencarian alat (Ctrl+K / \u2318K) untuk semua halaman mypdf.id.
import { createIcons, icons } from 'lucide';

interface ToolItem {
  n: string;
  s: string;
  c: string;
  h: string;
  i: string;
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
let tools: ToolItem[] | null = null;
let root: HTMLElement | null = null;
let input: HTMLInputElement;
let list: HTMLUListElement;
let countEl: HTMLElement;
let results: ToolItem[] = [];
let active = 0;
let lastFocus: Element | null = null;
let phosphorLoaded = false;

const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

async function loadTools(): Promise<ToolItem[]> {
  if (tools) return tools;
  try {
    const res = await fetch('/search-index.json');
    const data = (await res.json()) as { tools: ToolItem[] };
    tools = data.tools;
  } catch {
    tools = [];
  }
  return tools;
}

function loadPhosphor() {
  if (phosphorLoaded) return;
  phosphorLoaded = true;
  // @ts-expect-error modul CSS tanpa deklarasi tipe
  void import('@phosphor-icons/web/regular');
}

function iconEl(name: string): HTMLElement {
  const i = document.createElement('i');
  if (name.startsWith('ph-')) {
    i.className = `ph ${name}`;
  } else {
    i.setAttribute('data-lucide', name);
  }
  return i;
}

function render() {
  list.textContent = '';
  results.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'mp-pal-item' + (idx === active ? ' is-active' : '');
    li.setAttribute('role', 'option');
    li.dataset.index = String(idx);

    const tile = document.createElement('span');
    tile.className = 'mp-pal-tile';
    tile.appendChild(iconEl(item.i));

    const text = document.createElement('span');
    text.className = 'mp-pal-text';
    const name = document.createElement('span');
    name.className = 'mp-pal-name';
    name.textContent = item.n;
    const cat = document.createElement('span');
    cat.className = 'mp-pal-cat';
    cat.textContent = item.c;
    text.append(name, cat);

    const enter = document.createElement('span');
    enter.className = 'mp-pal-enter';
    enter.textContent = '\u21b5';

    li.append(tile, text, enter);
    list.appendChild(li);
  });
  if (results.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'mp-pal-empty';
    empty.textContent = 'Tidak ada alat yang cocok.';
    list.appendChild(empty);
  }
  countEl.textContent = `${results.length} alat`;
  createIcons({ icons, root: list });
  list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
}

function search() {
  const words = normalize(input.value).split(/\s+/).filter(Boolean);
  const all = tools || [];
  if (words.length === 0) {
    results = all;
  } else {
    results = all
      .map((t) => {
        const name = normalize(t.n);
        const rest = normalize(`${t.s} ${t.c}`);
        if (!words.every((w) => name.includes(w) || rest.includes(w))) {
          return null;
        }
        const score = words.every((w) => name.startsWith(w))
          ? 0
          : words.every((w) => name.includes(w))
            ? 1
            : 2;
        return { t, score };
      })
      .filter((r): r is { t: ToolItem; score: number } => r !== null)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.t);
  }
  active = 0;
  render();
}

function build(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mp-pal';
  el.hidden = true;
  el.innerHTML = `
    <div class="mp-pal-backdrop" data-pal-close></div>
    <div class="mp-pal-box" role="dialog" aria-modal="true" aria-label="Cari alat">
      <div class="mp-pal-head">
        <i data-lucide="search"></i>
        <input type="text" class="mp-pal-input" placeholder="Cari alat..." aria-label="Cari alat" autocomplete="off" spellcheck="false" />
        <button type="button" class="mp-pal-x" data-pal-close aria-label="Tutup"><i data-lucide="x"></i></button>
      </div>
      <ul class="mp-pal-list" role="listbox"></ul>
      <div class="mp-pal-foot">
        <span><kbd>\u2191\u2193</kbd> navigasi</span>
        <span><kbd>\u21b5</kbd> buka</span>
        <span><kbd>esc</kbd> tutup</span>
        <span class="mp-pal-count"></span>
      </div>
    </div>`;
  document.body.appendChild(el);
  createIcons({ icons, root: el });
  input = el.querySelector('.mp-pal-input') as HTMLInputElement;
  list = el.querySelector('.mp-pal-list') as HTMLUListElement;
  countEl = el.querySelector('.mp-pal-count') as HTMLElement;

  input.addEventListener('input', search);
  el.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-pal-close]')) {
      closePalette();
      return;
    }
    const li = target.closest('.mp-pal-item') as HTMLElement | null;
    if (li) go(Number(li.dataset.index));
  });
  list.addEventListener('mousemove', (e) => {
    const li = (e.target as HTMLElement).closest(
      '.mp-pal-item'
    ) as HTMLElement | null;
    if (!li) return;
    const idx = Number(li.dataset.index);
    if (idx !== active) {
      list.querySelector('.is-active')?.classList.remove('is-active');
      li.classList.add('is-active');
      active = idx;
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      active =
        (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) %
        results.length;
      list.querySelector('.is-active')?.classList.remove('is-active');
      const next = list.children[active] as HTMLElement | undefined;
      next?.classList.add('is-active');
      next?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
    }
  });
  return el;
}

function go(idx: number) {
  const item = results[idx];
  if (item) window.location.href = item.h;
}

async function openPalette() {
  if (!root) root = build();
  if (!root.hidden) return;
  lastFocus = document.activeElement;
  loadPhosphor();
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  input.value = '';
  input.focus();
  await loadTools();
  search();
  input.focus();
}

function closePalette() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.style.overflow = '';
  (lastFocus as HTMLElement | null)?.focus?.();
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (root && !root.hidden) closePalette();
    else void openPalette();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-open-search]').forEach((el) => {
    el.addEventListener('click', () => void openPalette());
  });
  document.querySelectorAll('.mp-kbd').forEach((el) => {
    el.textContent = isMac ? '\u2318K' : 'Ctrl K';
  });
});
