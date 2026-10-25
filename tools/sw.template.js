/* Fetra offline copy: keeps the app on the device. Build __VERSION__ */
const CACHE = "fetra-__VERSION__", FONTS = "fetra-fonts";
const FILES = ["./", "index.html", "app.enc", "manifest.webmanifest", "../icon-512.png", "../apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("fetra-") && k!==CACHE && k!==FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== "GET") return;
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    /* fonts: from the device first, fetched once */
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; }))));
    return;
  }
  if(url.origin !== location.origin) return;
  /* own files: the newest when online, the kept copy when not */
  e.respondWith(caches.open(CACHE).then(c => fetch(req).then(r => { if(r.ok) c.put(req, r.clone()); return r; })
    .catch(() => c.match(req, {ignoreSearch:true}).then(hit => hit || c.match("index.html")))));
});
