// services/url.ts

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, "");

const resolveApiBaseUrl = (): string => {
  const envApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envApiUrl) {
    return normalizeBaseUrl(envApiUrl);
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isProduction =
    hostname === "cleanpage.shop" ||
    hostname === "www.cleanpage.shop" ||
    hostname.includes("cleanpage.shop");

  if (isProduction) {
    return "https://cleanpage.shop/api";
  }

  // Vite dev server is 5173 in this project; default backend to Django's runserver port.
  if (isLocalhost && window.location.port === "5173") {
    return `${window.location.protocol}//${hostname}:8080/api`;
  }

  // When frontend is served by Django/static hosting, keep API same-origin.
  return `${window.location.protocol}//${window.location.host}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();

export { API_BASE_URL };
