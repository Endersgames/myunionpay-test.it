import { getAuthToken } from "@/lib/api";
import { withApiPath } from "@/lib/runtime-config";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function serviceWorkerDisabled() {
  return process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "false";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function supportsPushNotifications() {
  if (typeof window === "undefined" || serviceWorkerDisabled()) {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermissionState() {
  if (!supportsPushNotifications()) {
    return "unsupported";
  }

  return Notification.permission;
}

export function shouldShowPushOnboardingStep() {
  const permission = getNotificationPermissionState();
  return permission === "default" || permission === "denied";
}

async function getVapidKey() {
  const response = await fetch(withApiPath("/push/vapid-key"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Chiave push non disponibile");
  }

  const data = await response.json();
  if (typeof data.publicKey === "string" && data.publicKey.length > 80) {
    return data.publicKey;
  }

  if (typeof VAPID_PUBLIC_KEY === "string" && VAPID_PUBLIC_KEY.length > 80) {
    return VAPID_PUBLIC_KEY;
  }

  throw new Error("Chiave push non valida");
}

async function getServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration("/");
  if (existingRegistration) {
    existingRegistration.update();
    return existingRegistration;
  }

  const registration = await navigator.serviceWorker.register("/service-worker.js", {
    scope: "/",
    updateViaCache: "none",
  });
  registration.update();

  try {
    return await navigator.serviceWorker.ready;
  } catch (_error) {
    return registration;
  }
}

async function persistSubscription(subscription, token) {
  const subJson = subscription.toJSON();

  const response = await fetch(withApiPath("/push/subscribe"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }),
  });

  if (!response.ok) {
    throw new Error("Registrazione notifiche fallita");
  }
}

export async function ensurePushSubscription({ requestPermission = false } = {}) {
  if (!supportsPushNotifications()) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
    };
  }

  let permission = Notification.permission;
  if (requestPermission && permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      supported: true,
      permission,
      subscribed: false,
    };
  }

  const token = getAuthToken();
  if (!token) {
    return {
      supported: true,
      permission,
      subscribed: false,
    };
  }

  const registration = await getServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const vapidKey = await getVapidKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await persistSubscription(subscription, token);

  return {
    supported: true,
    permission,
    subscribed: true,
  };
}

export async function syncPushSubscription() {
  return ensurePushSubscription({ requestPermission: false });
}
