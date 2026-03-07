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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <MyuMascot />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
