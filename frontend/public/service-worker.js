// Service Worker per My Union Pay PWA con Push Notifications
const CACHE_NAME = 'myunionpay-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('My Union Pay: Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('My Union Pay: Cache failed', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('My Union Pay: Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// ========================
// PUSH NOTIFICATIONS
// ========================

// Handle push event - show notification
self.addEventListener('push', (event) => {
  console.log('My Union Pay: Push received', event);
  
  let data = {
    title: 'My Union Pay',
    body: 'Hai una nuova notifica',
    icon: '/logo.png',
    badge: '/logo.png',
    data: {}
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('My Union Pay: Failed to parse push data', e);
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    tag: data.tag || 'myunionpay-notification',
    data: data.data,
    vibrate: [200, 100, 200, 100, 200], // Vibration pattern
    requireInteraction: true, // Keep notification visible
    actions: [
      { action: 'open', title: 'Apri' },
      { action: 'dismiss', title: 'Chiudi' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('My Union Pay: Notification clicked', event);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            // Navigate to notifications page
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data
            });
            return;
          }
        }
        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow('/notifications');
        }
      })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('My Union Pay: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
