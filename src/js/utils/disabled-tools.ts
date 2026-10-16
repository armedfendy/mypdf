import type { AppConfig } from '@/types';

const RENAMED_TOOL_IDS: Record<string, string> = {
  'decrypt-pdf': 'unlock-pdf',
  'encrypt-pdf': 'protect-pdf',
  'pdf-to-docx': 'pdf-to-word',
};

function normalizeToolId(toolId: string): string {
  return RENAMED_TOOL_IDS[toolId] ?? toolId;
}

const disabledToolsSet = new Set<string>(
  __DISABLED_TOOLS__.map(normalizeToolId)
);
let runtimeConfigPromise: Promise<void> | null = null;
let editorDisabledCategories: string[] = [];
let runtimeAdsEnabled = true;

// Satu promise bersama: pemanggil kedua (mis. ads.ts) menunggu fetch yang
// sama selesai, bukan langsung kembali sebelum config terbaca.
export function loadRuntimeConfig(): Promise<void> {
  runtimeConfigPromise ??= fetchRuntimeConfig();
  return runtimeConfigPromise;
}

async function fetchRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, {
      cache: 'no-cache',
    });
    if (!response.ok) return;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return;
    }

    const config: AppConfig = await response.json();
    if (Array.isArray(config.disabledTools)) {
      for (const toolId of config.disabledTools) {
        if (typeof toolId === 'string') {
          disabledToolsSet.add(normalizeToolId(toolId));
        }
      }
    }
    if (config.adsEnabled === false) {
      runtimeAdsEnabled = false;
    }
    if (Array.isArray(config.editorDisabledCategories)) {
      editorDisabledCategories = config.editorDisabledCategories.filter(
        (c): c is string => typeof c === 'string'
      );
    }
  } catch (err) {
    console.warn('[LOAD_RUNTIME_CONFIG] Skipped runtime config:', err);
  }
}

/** false bila config.json berisi "adsEnabled": false. */
export function areAdsEnabledAtRuntime(): boolean {
  return runtimeAdsEnabled;
}

export function isToolDisabled(toolId: string): boolean {
  return disabledToolsSet.has(toolId);
}

export function getToolIdFromPath(): string | null {
  const path = window.location.pathname;
  const withExt = path.match(/\/([^/]+)\.html$/);
  if (withExt) return withExt[1];
  const withoutExt = path.match(/\/([^/]+)\/?$/);
  return withoutExt?.[1] ?? null;
}

export function getEditorDisabledCategories(): string[] {
  return editorDisabledCategories;
}

export function isCurrentPageDisabled(): boolean {
  const toolId = getToolIdFromPath();
  if (!toolId) return false;
  return isToolDisabled(toolId);
}
