"use client";

import { ProtectedRoute } from "@/App";
import {
  AdminContentPage,
  AdminFeaturesPage,
  AdminGiftCardsPage,
  AdminMyuTrainingPage,
  AdminOpenAIPage,
  AdminUsersPage,
  DashboardPage,
  DatiPersonaliPage,
  GoogleAuthCallbackPage,
  LoginPage,
  MarketplacePage,
  MenuManagePage,
  MerchantDashboardPage,
  MieGiftCardPage,
  MyuChatPage,
  NotificationsPage,
  PrivacyPolicyPage,
  ProfilePage,
  QRCodePage,
  RegisterPage,
  RimuoviAccountPage,
  ScannerPage,
  SendNotificationPage,
  SettingsPage,
  SimActivationPage,
  SimDashboardPage,
  TrattamentoDatiPage,
} from "@/lib/legacy-pages";
import { getLegacyRoute } from "@/lib/legacy-route-config";

const routeComponents = {
  AdminContentPage,
  AdminFeaturesPage,
  AdminGiftCardsPage,
  AdminMyuTrainingPage,
  AdminOpenAIPage,
  AdminUsersPage,
  DashboardPage,
  DatiPersonaliPage,
  GoogleAuthCallbackPage,
  LoginPage,
  MarketplacePage,
  MenuManagePage,
  MerchantDashboardPage,
  MieGiftCardPage,
  MyuChatPage,
  NotificationsPage,
  PrivacyPolicyPage,
  ProfilePage,
  QRCodePage,
  RegisterPage,
  RimuoviAccountPage,
  ScannerPage,
  SendNotificationPage,
  SettingsPage,
  SimActivationPage,
  SimDashboardPage,
  TrattamentoDatiPage,
};

export default function LegacyRouteRenderer({ routeKey }) {
  const resolvedRoute = getLegacyRoute(routeKey);

  if (!resolvedRoute) {
    return null;
  }
  const { route } = resolvedRoute;

  const RouteComponent = routeComponents[route.pageId];

  if (!RouteComponent) {
    return null;
  }

  const content = <RouteComponent />;
  return route.protected ? <ProtectedRoute>{content}</ProtectedRoute> : content;
}
