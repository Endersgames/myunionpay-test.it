import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Firebase Auth
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Compila tutti i campi");
      return;
    }
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Bentornato!");
      // Firebase auth state change will handle navigation via AuthProvider
      setTimeout(() => navigate("/dashboard"), 100);
    } catch (err) {
      console.error("Login error:", err);
      
      // Handle Firebase Auth errors
      let errorMessage = "Credenziali non valide";
      if (err.code === "auth/user-not-found") {
        errorMessage = "Utente non trovato";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Password errata";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Email non valida";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Troppi tentativi. Riprova più tardi";
      }
      
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] px-6 py-8">
      {/* Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#2B7AB8] opacity-10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-md mx-auto">
        {/* Header */}
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Indietro</span>
        </button>

        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Bentornato</h1>
          <p className="text-[#A1A1AA]">Accedi al tuo account My Union Pay</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="la-tua@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl"
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl pr-12"
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Accedi"
            )}
          </Button>
        </form>

        <p className="text-center text-[#A1A1AA] mt-8">
          Non hai un account?{" "}
          <Link to="/register" className="text-[#2B7AB8] hover:underline" data-testid="register-link">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
