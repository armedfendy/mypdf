import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIcons } from '../js/utils/lucide-lite';
import { icons } from '../js/utils/lucide-icons';

const ROOT = process.cwd();

function collect(dir: string, exts: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const toPascal = (name: string) =>
  name.replace(/(^|-)([a-z0-9])/g, (_m, _d, c: string) => c.toUpperCase());

describe('subset ikon lucide (lucide-icons.ts)', () => {
  it('memuat setiap ikon yang ditulis statis di HTML halaman', () => {
    const files = [
      ...readdirSync(ROOT)
        .filter((f) => f.endsWith('.html'))
        .map((f) => join(ROOT, f)),
      ...collect(join(ROOT, 'src', 'pages'), ['.html']),
      ...collect(join(ROOT, 'src', 'partials'), ['.html']),
    ];
    const missing = new Set<string>();
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      for (const m of html.matchAll(/data-lucide="([a-z0-9-]+)"/g)) {
        if (!icons[toPascal(m[1])]) missing.add(m[1]);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('subset Phosphor memuat setiap ikon ph-* di HTML dan config/tools.ts', () => {
    const subset = readFileSync(
      join(ROOT, 'src', 'css', 'phosphor-subset.css'),
      'utf8'
    );
    const full = readFileSync(
      join(ROOT, 'node_modules/@phosphor-icons/web/src/regular/style.css'),
      'utf8'
    );
    const files = [
      ...readdirSync(ROOT)
        .filter((f) => f.endsWith('.html'))
        .map((f) => join(ROOT, f)),
      ...collect(join(ROOT, 'src', 'pages'), ['.html']),
      join(ROOT, 'src', 'js', 'config', 'tools.ts'),
    ];
    const missing = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bph-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
        const rule = `.ph.ph-${m[1]}:before`;
        if (full.includes(rule) && !subset.includes(rule)) missing.add(m[1]);
      }
    }
    expect([...missing]).toEqual([]);
    expect(subset).toContain('font-display: swap');
  });

  it('createIcons ringan mengganti <i data-lucide> dengan SVG', () => {
    document.body.innerHTML =
      '<div id="r"><i data-lucide="x" class="w-4"></i></div>';
    createIcons({ icons, root: document.getElementById('r')! });
    const svg = document.querySelector('#r svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('class')).toContain('lucide-x');
    expect(svg!.getAttribute('class')).toContain('w-4');
  });
});
