import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// Firebase
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from "@/lib/firestore";

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

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        // Fetch user profile from Firestore
        try {
          const profile = await getUserProfile(fbUser.uid);
          setUser(profile);
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      setUser(profile);
      return profile;
    }
    return null;
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser,
      loading, 
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
