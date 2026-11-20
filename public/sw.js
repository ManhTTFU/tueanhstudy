/**
 * Service worker – Bé Vui Học Toán (PWA).
 *  - Trang (điều hướng): mạng trước, mất mạng thì dùng bản đã lưu => mở app được khi offline.
 *  - /static/* (JS/CSS có hash, không bao giờ đổi): lấy từ bộ nhớ đệm trước.
 *  - /assets/* hình ảnh: dùng bản đã lưu ngay, đồng thời tải bản mới ở nền.
 *  - KHÔNG lưu /api/* (dữ liệu học tập luôn lấy từ máy chủ) và file âm thanh
 *    (Safari tải âm thanh theo từng đoạn – Range – không lưu đệm được).
 * Đổi VERSION khi muốn xoá toàn bộ bộ nhớ đệm cũ.
 */
const VERSION = 'v1';
const SHELL_CACHE = `bvht-shell-${VERSION}`;
const ASSET_CACHE = `bvht-assets-${VERSION}`;
const SHELL = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/assets/mascot/mochi.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Lưu trang chính và các file JS/CSS mà nó dùng.
      const res = await fetch('/', { cache: 'reload' });
      if (res.ok) {
        const html = await res.clone().text();
        await cache.put('/', res);
        const files = [...html.matchAll(/(?:src|href)="(\/static\/[^"]+)"/g)].map((m) => m[1]);
        await cache.addAll([...new Set([...files, ...SHELL])]);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL_CACHE, ASSET_CACHE];
      for (const key of await caches.keys()) if (key.startsWith('bvht-') && !keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/sounds/') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(SHELL_CACHE)).put('/', res.clone());
          return res;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        if (hit) {
          event.waitUntil(fresh);
          return hit;
        }
        return (await fresh) || Response.error();
      })(),
    );
  }
});
