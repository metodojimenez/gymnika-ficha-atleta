/* Service worker mínimo de Gymnika: permite instalar la app en el teléfono.
   No guarda nada en caché (cada vez se carga la versión publicada); si no hay internet muestra un aviso simple. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Gymnika</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F2EC;color:#35292F;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    '<div><p style="font-weight:800;letter-spacing:.06em;font-size:20px;margin:0 0 8px">GYMNIKA</p><p style="margin:0">Sin conexión. Revisa tu internet y vuelve a intentarlo.</p></div></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )));
});
