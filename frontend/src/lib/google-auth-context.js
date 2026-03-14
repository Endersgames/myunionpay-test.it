const GOOGLE_AUTH_CONTEXT_KEY = "myuup-google-auth-context";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function setPendingGoogleAuthContext(context) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(GOOGLE_AUTH_CONTEXT_KEY, JSON.stringify(context || {}));
  } catch (error) {
    console.log("[Google Auth] Unable to persist auth context", error);
  }
}

export function getPendingGoogleAuthContext() {
  if (!canUseSessionStorage()) {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(GOOGLE_AUTH_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.log("[Google Auth] Unable to read auth context", error);
    return {};
  }
}

export function clearPendingGoogleAuthContext() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(GOOGLE_AUTH_CONTEXT_KEY);
  } catch (error) {
    console.log("[Google Auth] Unable to clear auth context", error);
  }
}
