const REFERRAL_CONTEXT_KEY = "myuup-referral-context";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveReferralContext(context) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(REFERRAL_CONTEXT_KEY, JSON.stringify(context || {}));
  } catch (_error) {}
}

export function getReferralContext() {
  if (!canUseSessionStorage()) {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(REFERRAL_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

export function clearReferralContext() {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(REFERRAL_CONTEXT_KEY);
  } catch (_error) {}
}
