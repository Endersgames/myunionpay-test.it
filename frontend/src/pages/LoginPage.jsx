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
      setTimeout(() => navigate("/dashboard"), 100);
    } catch (err) {
      console.error("Login error:", err);
      
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
    <div className="min-h-screen bg-white px-6 py-8">
      {/* Subtle glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#2B7AB8] opacity-5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-md mx-auto">
        {/* Header */}
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Indietro</span>
        </button>

        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2 text-[#1A1A1A]">Bentornato</h1>
          <p className="text-[#6B7280]">Accedi al tuo account My Union Pay</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#1A1A1A]">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="la-tua@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#1A1A1A]">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl pr-12 text-[#1A1A1A]"
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1A1A1A]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold text-white glow-primary"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Accedi"
            )}
          </Button>
        </form>

        <p className="text-center text-[#6B7280] mt-8">
          Non hai un account?{" "}
          <Link to="/register" className="text-[#2B7AB8] hover:underline font-medium" data-testid="register-link">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
