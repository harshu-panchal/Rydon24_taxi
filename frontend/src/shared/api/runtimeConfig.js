const DEFAULT_BACKEND_ORIGIN = 'http://localhost:5000';

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || `${DEFAULT_BACKEND_ORIGIN}/api/v1`,
);

export const BACKEND_ORIGIN = trimTrailingSlash(
  import.meta.env.VITE_BACKEND_ORIGIN ||
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_ASSET_BASE_URL ||
    API_BASE_URL.replace(/\/api(?:\/v1)?$/, ''),
);

export const BACKEND_LABEL = BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN;
