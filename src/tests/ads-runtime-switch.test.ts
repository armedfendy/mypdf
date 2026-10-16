import { afterEach, describe, expect, it, vi } from 'vitest';

function mockConfig(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
    })
  );
}

describe('saklar iklan runtime (config.json adsEnabled)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('mematikan iklan bila config.json berisi "adsEnabled": false', async () => {
    mockConfig({ adsEnabled: false });
    const mod = await import('../js/utils/disabled-tools');
    await mod.loadRuntimeConfig();
    expect(mod.areAdsEnabledAtRuntime()).toBe(false);
  });

  it('iklan tetap aktif bila adsEnabled tidak diisi', async () => {
    mockConfig({});
    const mod = await import('../js/utils/disabled-tools');
    await mod.loadRuntimeConfig();
    expect(mod.areAdsEnabledAtRuntime()).toBe(true);
  });

  it('pemanggil kedua menunggu fetch yang sama', async () => {
    mockConfig({ adsEnabled: false });
    const mod = await import('../js/utils/disabled-tools');
    const first = mod.loadRuntimeConfig();
    await mod.loadRuntimeConfig();
    expect(mod.areAdsEnabledAtRuntime()).toBe(false);
    await first;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
