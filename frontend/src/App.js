import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authAPI, clearAuth, getAuthToken } from "@/lib/api";

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const isGoogleCallbackPath = pathname === "/google-auth/callback";
      const callbackHasSession =
        queryParams.has("session_id") || hashParams.has("session_id");

      if (isGoogleCallbackPath && callbackHasSession) {
        setLoading(false);
        return;
      }

      const token = getAuthToken();
      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          console.error("[Auth] Initial auth/me failed", {
            pathname,
            error,
          });
          clearAuth();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [pathname]);

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
      console.error("[Auth] refreshUser auth/me failed", {
        pathname,
        error,
      });
      return null;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
};

function App() {
  return null;
}

export default App;
