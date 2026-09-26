import stripMineLogoUrl from "../assets/stripmine-logo.png";

// @decky/rollup emits the image under the plugin's static asset root and
// replaces this import with the exact 127.0.0.1:1337 URL. The optional
// override lets the standalone concept preview use its own local copy.
declare global {
  interface Window {
    __STRIPMINE_PREVIEW_LOGO__?: string;
  }
}

export const STRIPMINE_LOGO_URL =
  window.__STRIPMINE_PREVIEW_LOGO__ ?? stripMineLogoUrl;
