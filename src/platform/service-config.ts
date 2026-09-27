/** Public build-time address only. Model credentials are never read by extension builds. */
declare const __POND_SERVICE_URL__: string;
export const SERVICE_URL =
  typeof __POND_SERVICE_URL__ === "undefined"
    ? "http://127.0.0.1:8787/analyze"
    : __POND_SERVICE_URL__;
