self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("myUup: Push received", event);
  
  let data = {
    title: "myUup",
    body: "Hai una nuova notifica",
    icon: "/logo.png",
    badge: "/logo.png",
    data: {},
    tag: `myUup-${Date.now()}`,
    silent: false,
    renotify: true,
    requireInteraction: true,
    vibrate: [260, 120, 260, 120, 340],
    timestamp: Date.now(),
    soundHint: "default",
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error("myUup: Failed to parse push data", e);
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || "/logo.png",
    badge: data.badge || "/logo.png",
    tag: data.tag || `myUup-${Date.now()}`,
    data: data.data,
    silent: data.silent === true ? true : false,
    renotify: data.renotify !== false,
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [260, 120, 260, 120, 340],
    requireInteraction: data.requireInteraction !== false,
    timestamp: data.timestamp || Date.now(),
    actions: [
      { action: "open", title: "Apri" },
      { action: "dismiss", title: "Chiudi" }
    ]
  };
  
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      typeof BroadcastChannel !== "undefined"
        ? (() => {
            const channel = new BroadcastChannel("myuup-push");
            channel.postMessage({
              type: "PUSH_RECEIVED",
              data,
            });
            channel.close();
          })()
        : Promise.resolve(),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: "PUSH_RECEIVED",
            data,
          });
        }
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("myUup: Notification clicked", event);
  
  event.notification.close();
  
  if (event.action === "dismiss") {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({
              type: "NOTIFICATION_CLICKED",
              data: event.notification.data
            });
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/notifications");
        }
      }),
  );
});

self.addEventListener("message", (event) => {
  console.log("myUup: Message received", event.data);
  
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
