const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

/** Rewrite localhost/127.0.0.1 → current hostname so LAN devices hit the same machine. */
function resolveEnvUrl(envValue, fallback) {
  const raw = (envValue || '').trim();
  if (!raw) return fallback;
  return raw
    .replace('://localhost', `://${host}`)
    .replace('://127.0.0.1', `://${host}`);
}

export const API_BASE = resolveEnvUrl(
  import.meta.env.VITE_API_BASE,
  `http://${host}:5000`
);

export const SOCKET_SERVER = resolveEnvUrl(
  import.meta.env.VITE_SOCKET_URL,
  `http://${host}:5001`
);
