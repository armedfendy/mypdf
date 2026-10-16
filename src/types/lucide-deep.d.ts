// Impor langsung berkas ESM lucide (lihat src/js/utils/lucide-lite.ts).
declare module 'lucide/dist/esm/replaceElement.js' {
  import type { IconNode } from 'lucide';
  export default function replaceElement(
    element: Element,
    options: {
      nameAttr: string;
      icons: Record<string, IconNode>;
      attrs: Record<string, string>;
    }
  ): void;
}

declare module 'lucide/dist/esm/icons/*' {
  import type { IconNode } from 'lucide';
  const icon: IconNode;
  export default icon;
}
