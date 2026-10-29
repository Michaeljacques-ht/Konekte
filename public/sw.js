// Konekte — Service Worker (requis pour PWA / Play Store)
const CACHE = 'konekte-v97';
const STATIQUES = [
  '/style.css',
  '/app.js',
  '/compta.js',
  '/manifest.json',
  '/icone-192.png',
  '/icone-512.png',
  '/favicon.ico',
  '/apple-touch-icon.png'
];

// Installation : pré-cacher les fichiers statiques
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIQUES)));
  self.skipWaiting();
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie :
// - API (/api/...) : réseau uniquement (données temps réel, jamais de cache)
// - Pages HTML : réseau d'abord, cache en secours (hors ligne)
// - Statiques (css/js/png) : cache d'abord, réseau en secours
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // API : toujours le réseau
  if (url.pathname.startsWith('/api/')) return;

  // Pages HTML et URLs personnalisées d'entreprises
  const estPage =
    e.request.mode === 'navigate' || url.pathname.endsWith('.html');

  if (estPage) {
    e.respondWith(
      fetch(e.request)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
          return rep;
        })
        .catch(() =>
          caches.match(e.request).then(
            (r) =>
              r ||
              new Response(
                '<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne — Konekte</title><body style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#0B1424"><h1 style="color:#2563EB">📶 Pas de connexion</h1><p>Konekte a besoin d\'Internet pour afficher les rendez-vous.<br>Vérifiez votre connexion puis réessayez.</p><button onclick="location.reload()" style="background:#2563EB;color:#fff;border:0;padding:12px 28px;border-radius:8px;font-size:16px">Réessayer</button></body></html>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              )
          )
        )
    );
    return;
  }

  // Statiques : réseau d'abord, cache en secours.
  // (Le « cache d'abord » figeait les anciennes versions de app.js / style.css
  //  et empêchait toute mise à jour d'arriver jusqu'au navigateur.)
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ---- Notifications poussées ----
   Le message arrive chiffré, déchiffré par le navigateur, puis remis ici. */
self.addEventListener('push', (e) => {
  let d = { titre: 'Konekte', corps: 'Vous avez du nouveau.' };
  try { if (e.data) d = { ...d, ...e.data.json() }; } catch { /* charge illisible */ }
  e.waitUntil(self.registration.showNotification(d.titre, {
    body: d.corps,
    icon: '/icone-192.png',
    badge: '/icone-192.png',
    tag: d.tag || 'biznis',
    renotify: true,
    data: { url: d.url || '/dashboard.html' }
  }));
});

/* Au clic : on réutilise l'onglet déjà ouvert plutôt que d'en créer un. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cible = (e.notification.data && e.notification.data.url) || '/dashboard.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
    for (const c of liste) {
      if (c.url.includes(cible) && 'focus' in c) return c.focus();
    }
    return clients.openWindow(cible);
  }));
});
