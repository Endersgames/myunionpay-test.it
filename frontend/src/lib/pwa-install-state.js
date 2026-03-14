const POST_REGISTRATION_INSTALL_KEY = "myuup-post-registration-install";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function queuePostRegistrationInstall() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(POST_REGISTRATION_INSTALL_KEY, "pending");
  } catch (error) {
    console.log("[PWA] Unable to queue post-registration install", error);
  }
}

export function hasQueuedPostRegistrationInstall() {
  if (!canUseSessionStorage()) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(POST_REGISTRATION_INSTALL_KEY) === "pending";
  } catch (error) {
    console.log("[PWA] Unable to read post-registration install queue", error);
    return false;
  }
}

export function clearQueuedPostRegistrationInstall() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(POST_REGISTRATION_INSTALL_KEY);
  } catch (error) {
    console.log("[PWA] Unable to clear post-registration install queue", error);
  }
}
