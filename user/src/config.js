const isBrowser = typeof window !== 'undefined';
const host = isBrowser ? window.location.hostname : 'localhost';
const pageIsHttps = isBrowser && window.location.protocol === 'https:';

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
  );
}

/**
 * Resolve API/socket base URLs.
 * - On LAN/dev: rewrite localhost → current hostname so phones hit the same machine.
 * - On HTTPS pages: upgrade http→https so Socket.IO uses wss (avoids Mixed Content).
 * - On public hosts: do not rewrite localhost (that would point at the static host, e.g. Vercel).
 */
function resolveEnvUrl(envValue, localFallback) {
  const raw = (envValue || '').trim();
  let url = raw || (isLocalHostname(host) ? localFallback : '');

  if (!url) {
    console.error(
      '[config] Set VITE_API_BASE / VITE_SOCKET_URL to your HTTPS backend. ' +
        'Fallbacks like http://hostname:5000 are only for local/LAN.'
    );
    return localFallback.replace(/^http:/, pageIsHttps ? 'https:' : 'http:');
  }

  if (isLocalHostname(host)) {
    url = url
      .replace('://localhost', `://${host}`)
      .replace('://127.0.0.1', `://${host}`);
  }

  if (pageIsHttps && url.startsWith('http://')) {
    url = `https://${url.slice('http://'.length)}`;
  }

  return url;
}

export const API_BASE = resolveEnvUrl(
  import.meta.env.VITE_API_BASE,
  `http://${host}:5000`
);

export const SOCKET_SERVER = resolveEnvUrl(
  import.meta.env.VITE_SOCKET_URL,
  `http://${host}:5001`
);
