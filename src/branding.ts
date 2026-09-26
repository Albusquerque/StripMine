const isDeckyAssetServer = window.location.protocol === "http:" && window.location.port === "1337";

export const STRIPMINE_LOGO_URL = isDeckyAssetServer
  ? "http://127.0.0.1:1337/plugins/StripMine/assets/stripmine-logo.png"
  : new URL("../assets/stripmine-logo.png", window.location.href).href;
