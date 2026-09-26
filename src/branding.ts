export const STRIPMINE_LOGO_URL =
  window.location.protocol === "http:" && window.location.port !== "1337"
    ? `${window.location.origin}/assets/stripmine-logo.png`
    : "http://127.0.0.1:1337/plugins/StripMine/assets/stripmine-logo.png";
