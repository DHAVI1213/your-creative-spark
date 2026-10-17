/* NK Software — isolamento de origem para o processador de vídeo usar vários núcleos.
   Só mexe nas respostas do próprio site: páginas do painel (/app) e scripts/workers.
   O resto (outros sites, páginas públicas e de login) passa direto. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Páginas fora do painel (/, /entrar, /admin) ficam como estão (login com Google usa popup).
  if (req.mode === "navigate" && !url.pathname.startsWith("/app")) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0 || res.type === "opaque") return res;
      const h = new Headers(res.headers);
      h.set("Cross-Origin-Embedder-Policy", "require-corp");
      h.set("Cross-Origin-Opener-Policy", "same-origin");
      h.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }).catch(() => fetch(req)),
  );
});
