"use client";

import dynamic from "next/dynamic";
import RouteLoading from "@/components/RouteLoading";

const load = (loader) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <RouteLoading />,
  });

export const AdminContentPage = load(() => import("@/screens/AdminContentPage"));
export const AdminFeaturesPage = load(() => import("@/screens/AdminFeaturesPage"));
export const AdminGiftCardsPage = load(() => import("@/screens/AdminGiftCardsPage"));
export const AdminMyuTrainingPage = load(() => import("@/screens/AdminMyuTrainingPage"));
export const AdminOpenAIPage = load(() => import("@/screens/AdminOpenAIPage"));
export const AdminUsersPage = load(() => import("@/screens/AdminUsersPage"));
export const DashboardPage = load(() => import("@/screens/DashboardPage"));
export const DatiPersonaliPage = load(() => import("@/screens/DatiPersonaliPage"));
export const GoogleAuthCallbackPage = load(() => import("@/screens/GoogleAuthCallback"));
export const LandingPage = load(() => import("@/screens/LandingPage"));
export const LoginPage = load(() => import("@/screens/LoginPage"));
export const MarketplacePage = load(() => import("@/screens/MarketplacePage"));
export const MenuManagePage = load(() => import("@/screens/MenuManagePage"));
export const MerchantDashboardPage = load(() => import("@/screens/MerchantDashboardPage"));
export const MerchantDetailPage = load(() => import("@/screens/MerchantDetailPage"));
export const MerchantReferredUsersPage = load(() => import("@/screens/MerchantReferredUsersPage"));
export const MieGiftCardPage = load(() => import("@/screens/MieGiftCardPage"));
export const MyuChatPage = load(() => import("@/screens/MyuChatPage"));
export const NotificationsPage = load(() => import("@/screens/NotificationsPage"));
export const PaymentPage = load(() => import("@/screens/PaymentPage"));
export const PrivacyPolicyPage = load(() => import("@/screens/PrivacyPolicyPage"));
export const ProfilePage = load(() => import("@/screens/ProfilePage"));
export const PublicMenuPage = load(() => import("@/screens/PublicMenuPage"));
export const QRCodePage = load(() => import("@/screens/QRCodePage"));
export const RegisterPage = load(() => import("@/screens/RegisterPage"));
export const RimuoviAccountPage = load(() => import("@/screens/RimuoviAccountPage"));
export const ScanRedirectPage = load(() => import("@/screens/ScanRedirectPage"));
export const ScannerPage = load(() => import("@/screens/ScannerPage"));
export const SendNotificationPage = load(() => import("@/screens/SendNotificationPage"));
export const SettingsPage = load(() => import("@/screens/SettingsPage"));
export const SimActivationPage = load(() => import("@/screens/SimActivationPage"));
export const SimDashboardPage = load(() => import("@/screens/SimDashboardPage"));
export const TrattamentoDatiPage = load(() => import("@/screens/TrattamentoDatiPage"));
