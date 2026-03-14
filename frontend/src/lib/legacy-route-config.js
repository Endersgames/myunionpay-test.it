export const legacyRoutes = {
  "admin/content": { pageId: "AdminContentPage", protected: true },
  "admin/features": { pageId: "AdminFeaturesPage", protected: true },
  "admin/giftcards": { pageId: "AdminGiftCardsPage", protected: true },
  "admin/myu-training": { pageId: "AdminMyuTrainingPage", protected: true },
  "admin/openai": { pageId: "AdminOpenAIPage", protected: true },
  "admin/users": { pageId: "AdminUsersPage", protected: true },
  dashboard: { pageId: "DashboardPage", protected: true },
  "google-auth/callback": { pageId: "GoogleAuthCallbackPage" },
  login: { pageId: "LoginPage" },
  marketplace: { pageId: "MarketplacePage", protected: true },
  "menu-manage": { pageId: "MenuManagePage", protected: true },
  "merchant-dashboard": { pageId: "MerchantDashboardPage", protected: true },
  myu: { pageId: "MyuChatPage", protected: true },
  notifications: { pageId: "NotificationsPage", protected: true },
  profile: { pageId: "ProfilePage", protected: true },
  qr: { pageId: "QRCodePage", protected: true },
  register: { pageId: "RegisterPage" },
  scan: { pageId: "ScannerPage", protected: true },
  "send-notification": { pageId: "SendNotificationPage", protected: true },
  settings: { pageId: "SettingsPage", protected: true },
  "settings/data-treatment": { pageId: "TrattamentoDatiPage", protected: true },
  "settings/delete-account": { pageId: "RimuoviAccountPage", protected: true },
  "settings/gift-cards": { pageId: "MieGiftCardPage", protected: true },
  "settings/personal": { pageId: "DatiPersonaliPage", protected: true },
  "settings/privacy": { pageId: "PrivacyPolicyPage", protected: true },
  "sim-activation": { pageId: "SimActivationPage", protected: true },
  "sim-dashboard": { pageId: "SimDashboardPage", protected: true },
};

const normalizeSegment = (segment) => {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment).trim().toLowerCase();
  } catch (_error) {
    return String(segment).trim().toLowerCase();
  }
};

export const normalizeLegacyRouteKey = (routeKey) => {
  if (!routeKey) return "";
  const normalized = String(routeKey)
    .split("/")
    .map((segment) => normalizeSegment(segment))
    .filter(Boolean)
    .join("/");
  return normalized.replace(/^\/+|\/+$/g, "");
};

export const getLegacyRoute = (routeKey) => {
  const normalizedKey = normalizeLegacyRouteKey(routeKey);
  if (!normalizedKey) {
    return null;
  }

  const route = legacyRoutes[normalizedKey];
  if (!route) {
    return null;
  }

  return {
    key: normalizedKey,
    route,
  };
};
