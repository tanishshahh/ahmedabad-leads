// App shell cached for offline use; lead data is always fetched fresh (network first).
const SHELL = "leads-shell-v5";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const net = fetch(e.request).then((r) => { const c = r.clone(); caches.open(SHELL).then((x) => x.put(e.request, c)); return r; });
  e.respondWith(net.catch(() => caches.match(e.request)));
});
