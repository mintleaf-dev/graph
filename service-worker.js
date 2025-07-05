// Service Worker для push-уведомлений

// Событие установки (обычно не нужно менять)
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Событие активации (обычно не нужно менять)
self.addEventListener('activate', event => {
  self.clients.claim();
});

// Событие получения push-сообщения
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Напоминание', body: event.data.text() };
    }
  }
  const title = data.title || 'Напоминание';
  const options = {
    body: data.body || 'У вас есть новое напоминание!',
    icon: data.icon || 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    badge: data.badge || 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
    data: data.url ? { url: data.url } : {}
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (url) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        for (let client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});
