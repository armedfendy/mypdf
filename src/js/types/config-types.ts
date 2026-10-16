export interface AppConfig {
  disabledTools?: string[];
  editorDisabledCategories?: string[];
  /** mypdf.id: false mematikan iklan tanpa build ulang (lihat ads.ts). */
  adsEnabled?: boolean;
}
