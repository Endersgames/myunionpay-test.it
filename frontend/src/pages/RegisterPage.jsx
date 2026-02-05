import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Gift } from "lucide-react";
import { toast } from "sonner";

// Firebase Auth
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { createUserProfile, getUserByReferralCode, processReferral } from "@/lib/firestore";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const redirectTo = searchParams.get("redirect");
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    referral_code: searchParams.get("ref") || ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.phone || !formData.password) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }
    setLoading(true);
    
    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const firebaseUser = userCredential.user;
      
      // 2. Create user profile in Firestore
      await createUserProfile(firebaseUser.uid, {
        email: formData.email,
        phone: formData.phone,
        full_name: formData.full_name
      });
      
      // 3. Handle referral if provided
      if (formData.referral_code) {
        const referrer = await getUserByReferralCode(formData.referral_code);
        if (referrer) {
          await processReferral(referrer.id, firebaseUser.uid);
          toast.success("Bonus referral applicato! +1 UP per te e per chi ti ha invitato");
        }
      }
      
      toast.success("Account creato! Benvenuto in UpPay");
      
      // Redirect to payment page if came from QR scan, otherwise dashboard
      const destination = redirectTo || "/dashboard";
      setTimeout(() => navigate(destination), 100);
      
    } catch (err) {
      console.error("Registration error:", err);
      
      // Handle Firebase Auth errors
      let errorMessage = "Errore durante la registrazione";
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "Email già registrata";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Email non valida";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password troppo debole";
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
          <h1 className="font-heading text-3xl font-bold mb-2">Crea Account</h1>
          <p className="text-[#A1A1AA]">Unisciti a UpPay in pochi secondi</p>
        </div>

        {formData.referral_code && (
          <div className="bg-[#121212] border border-[#E85A24]/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <Gift className="w-6 h-6 text-[#E85A24]" />
            <div>
              <p className="font-semibold text-[#E85A24]">Codice Referral Applicato!</p>
              <p className="text-sm text-[#A1A1AA]">Riceverai 1 UP bonus alla registrazione</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Mario Rossi"
              value={formData.full_name}
              onChange={handleChange("full_name")}
              className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl"
              data-testid="fullname-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="la-tua@email.com"
              value={formData.email}
              onChange={handleChange("email")}
              className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl"
              data-testid="email-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+39 333 1234567"
              value={formData.phone}
              onChange={handleChange("phone")}
              className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl"
              data-testid="phone-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimo 6 caratteri"
                value={formData.password}
                onChange={handleChange("password")}
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

          <div className="space-y-2">
            <Label htmlFor="referral">Codice Referral (opzionale)</Label>
            <Input
              id="referral"
              type="text"
              placeholder="REFXXXXX"
              value={formData.referral_code}
              onChange={handleChange("referral_code")}
              className="h-12 bg-[#121212] border-white/10 focus:border-[#2B7AB8] rounded-xl"
              data-testid="referral-input"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-lg font-semibold glow-primary mt-4"
            data-testid="register-submit-btn"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Crea Account"
            )}
          </Button>
        </form>

        <p className="text-center text-[#A1A1AA] mt-8">
          Hai già un account?{" "}
          <Link to="/login" className="text-[#7C3AED] hover:underline" data-testid="login-link">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
