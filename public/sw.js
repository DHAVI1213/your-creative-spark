// Service worker da Fábrica de Conteúdo: deixa o app instalável e abrindo rápido.
// Páginas: tenta a rede primeiro (sempre a versão mais nova) e usa o cache se estiver offline.
// Arquivos estáticos (JS, CSS, ícones, fontes): cache primeiro.
const VERSION = "v2";
const STATIC_CACHE = `fabrica-static-${VERSION}`;
const PAGES_CACHE = `fabrica-pages-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  const isStatic =
    (url.origin === self.location.origin &&
      /\.(js|css|png|svg|ico|woff2?|webmanifest)$/.test(url.pathname)) ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "unpkg.com";

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
