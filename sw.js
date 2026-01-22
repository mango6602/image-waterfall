/* eslint-disable no-restricted-globals */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `image-waterfall-pwa-${CACHE_VERSION}`;

// 仅缓存应用壳（App Shell），图片内容来自本地文件夹/Blob URL，不由 SW 接管。
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './js/dom.js',
  './js/editor.js',
  './js/file-system.js',
  './js/gallery.js',
  './js/image-loader.js',
  './js/state.js',
  './js/utils.js',
  './js/viewer.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('image-waterfall-pwa-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      ),
      self.clients.claim()
    ])
  );
});

function isSameOrigin(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return url.origin === self.location.origin;
  } catch {
    return false;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) cache.put(request, resp.clone());
  return resp;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || cached;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request || request.method !== 'GET') return;
  if (!isSameOrigin(request.url)) return;

  const accept = request.headers.get('accept') || '';
  const isNavigation = request.mode === 'navigate' || accept.includes('text/html');

  // SPA-ish：页面导航优先返回缓存的 index.html，离线可打开应用。
  if (isNavigation) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          fetch(request)
            .then((resp) => {
              if (resp && resp.ok) cache.put('./index.html', resp.clone());
              return resp;
            })
            .catch(() => cache.match('./index.html'))
        )
    );
    return;
  }

  // 静态资源：CSS/JS/manifest/icon 用 SWR，更容易获得更新。
  const url = new URL(request.url);
  const isStatic =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico');

  event.respondWith(isStatic ? staleWhileRevalidate(request) : cacheFirst(request));
});
