import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// API Service
import { authAPI, setAuthToken, getAuthToken, clearAuth } from "@/lib/api";

// Pages
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import QRCodePage from "@/pages/QRCodePage";
import ScannerPage from "@/pages/ScannerPage";
import PaymentPage from "@/pages/PaymentPage";
import MarketplacePage from "@/pages/MarketplacePage";
import MerchantDetailPage from "@/pages/MerchantDetailPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ProfilePage from "@/pages/ProfilePage";
import MerchantDashboardPage from "@/pages/MerchantDashboardPage";
import SendNotificationPage from "@/pages/SendNotificationPage";
import ScanRedirectPage from "@/pages/ScanRedirectPage";
import SimActivationPage from "@/pages/SimActivationPage";
import SimDashboardPage from "@/pages/SimDashboardPage";
import AdminGiftCardsPage from "@/pages/AdminGiftCardsPage";
import PublicMenuPage from "@/pages/PublicMenuPage";
import MenuManagePage from "@/pages/MenuManagePage";
import MyuChatPage from "@/pages/MyuChatPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminOpenAIPage from "@/pages/AdminOpenAIPage";
import MerchantReferredUsersPage from "@/pages/MerchantReferredUsersPage";
import GoogleAuthCallback from "@/pages/GoogleAuthCallback";
import SettingsPage from "@/pages/SettingsPage";
import DatiPersonaliPage from "@/pages/DatiPersonaliPage";
import TrattamentoDatiPage from "@/pages/TrattamentoDatiPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import RimuoviAccountPage from "@/pages/RimuoviAccountPage";
import MieGiftCardPage from "@/pages/MieGiftCardPage";
import AdminContentPage from "@/pages/AdminContentPage";
import AdminFeaturesPage from "@/pages/AdminFeaturesPage";
import MyuMascot from "@/components/MyuMascot";
import ChromePromptBanner from "@/components/ChromePromptBanner";

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      // CRITICAL: If returning from Google OAuth callback, skip the /me check.
      // GoogleAuthCallback will exchange the session_id and establish the session first.
      if (window.location.hash?.includes('session_id=')) {
        setLoading(false);
        return;
      }

      const token = getAuthToken();
      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          console.error("Auth check failed:", error);
          clearAuth();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const result = await authAPI.login(email, password);
    const userData = await authAPI.getMe();
    setUser(userData);
    return result;
  };

  const register = async (data) => {
    const result = await authAPI.register(data);
    const userData = await authAPI.getMe();
    setUser(userData);
    return result;
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error("Refresh user failed:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login,
      register,
      logout, 
      refreshUser,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function AppContent() {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Detect session_id synchronously during render to prevent race conditions
  if (window.location.hash?.includes('session_id=')) {
    return <GoogleAuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/s/:qrCode" element={<ScanRedirectPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/qr" element={<ProtectedRoute><QRCodePage /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute><ScannerPage /></ProtectedRoute>} />
      <Route path="/pay/:qrCode" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
      <Route path="/merchant/:id" element={<MerchantDetailPage />} />
      <Route path="/menu/:merchantId" element={<PublicMenuPage />} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/merchant-dashboard" element={<ProtectedRoute><MerchantDashboardPage /></ProtectedRoute>} />
      <Route path="/send-notification" element={<ProtectedRoute><SendNotificationPage /></ProtectedRoute>} />
      <Route path="/sim-activation" element={<ProtectedRoute><SimActivationPage /></ProtectedRoute>} />
      <Route path="/sim-dashboard" element={<ProtectedRoute><SimDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/giftcards" element={<ProtectedRoute><AdminGiftCardsPage /></ProtectedRoute>} />
      <Route path="/menu-manage" element={<ProtectedRoute><MenuManagePage /></ProtectedRoute>} />
      <Route path="/myu" element={<ProtectedRoute><MyuChatPage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/openai" element={<ProtectedRoute><AdminOpenAIPage /></ProtectedRoute>} />
      <Route path="/merchant/referred-users" element={<ProtectedRoute><MerchantReferredUsersPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/personal" element={<ProtectedRoute><DatiPersonaliPage /></ProtectedRoute>} />
      <Route path="/settings/data-treatment" element={<ProtectedRoute><TrattamentoDatiPage /></ProtectedRoute>} />
      <Route path="/settings/privacy" element={<ProtectedRoute><PrivacyPolicyPage /></ProtectedRoute>} />
      <Route path="/settings/delete-account" element={<ProtectedRoute><RimuoviAccountPage /></ProtectedRoute>} />
      <Route path="/settings/gift-cards" element={<ProtectedRoute><MieGiftCardPage /></ProtectedRoute>} />
      <Route path="/admin/content" element={<ProtectedRoute><AdminContentPage /></ProtectedRoute>} />
      <Route path="/admin/features" element={<ProtectedRoute><AdminFeaturesPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChromePromptBanner />
        <Toaster 
          position="top-center" 
          richColors 
          theme="light"
          toastOptions={{
            style: {
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.1)',
            }
          }}
        />
        <AppContent />
        <MyuMascot />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
