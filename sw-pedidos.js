// Service Worker — Dolciangel Pedidos
const STORE = 'da-sw-notifs-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    clients.claim().then(() => checkDueNotifications())
  );
});

// Also check on every fetch (user opens/uses the app)
self.addEventListener('fetch', e => {
  checkDueNotifications();
});

async function checkDueNotifications() {
  try {
    const cache = await caches.open(STORE);
    const res = await cache.match('scheduled');
    if (!res) return;
    const notifs = await res.json();
    const now = Date.now();
    let changed = false;

    for (const n of notifs) {
      if (!n.shown && n.triggerAt <= now) {
        await self.registration.showNotification(n.title, {
          body: n.body,
          tag: n.id,
          requireInteraction: true,
          icon: 'https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f370.svg'
        });
        n.shown = true;
        changed = true;
      }
    }

    if (changed) {
      await cache.put('scheduled', new Response(JSON.stringify(notifs)));
    }
  } catch (err) {
    console.log('[SW] checkDue error:', err);
  }
}

// Messages from main page
self.addEventListener('message', async e => {
  if (!e.data) return;
  if (e.data.type === 'SCHEDULE') {
    try {
      const cache = await caches.open(STORE);
      await cache.put('scheduled', new Response(JSON.stringify(e.data.notifs || [])));
    } catch (err) {
      console.log('[SW] schedule error:', err);
    }
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length > 0) return cs[0].focus();
      return clients.openWindow('dolciangel-pedidos.html');
    })
  );
});
