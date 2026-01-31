import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

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
import ChromePromptBanner from "@/components/ChromePromptBanner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  const fetchUser = async (authToken) => {
    const tokenToUse = authToken || token;
    if (!tokenToUse) {
      setLoading(false);
      return null;
    }
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenToUse}` }
      });
      setUser(response.data);
      setLoading(false);
      return response.data;
    } catch (e) {
      console.error("Auth error:", e);
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const newToken = response.data.token;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    // Fetch user immediately with the new token
    await fetchUser(newToken);
    return response.data;
  };

  const register = async (data) => {
    const response = await axios.post(`${API}/auth/register`, data);
    const newToken = response.data.token;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    // Fetch user immediately with the new token
    await fetchUser(newToken);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = () => fetchUser(token);

  return (
    <AuthContext.Provider value={{ user, loading, token, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
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
          theme="dark"
          toastOptions={{
            style: {
              background: '#121212',
              border: '1px solid rgba(255,255,255,0.1)',
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
          <Route path="/merchant/:id" element={<ProtectedRoute><MerchantDetailPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/merchant-dashboard" element={<ProtectedRoute><MerchantDashboardPage /></ProtectedRoute>} />
          <Route path="/send-notification" element={<ProtectedRoute><SendNotificationPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
