import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authAPI, setAuthToken } from "@/lib/api";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const hasProcessed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [googleData, setGoogleData] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace("#", ""));
      const sid = params.get("session_id");

      if (!sid) {
        toast.error("Sessione Google non trovata");
        navigate("/login", { replace: true });
        return;
      }

      try {
        const result = await authAPI.googleCallback(sid);

        if (result.is_new) {
          setSessionId(sid);
          setGoogleData(result);
          setNeedsPhone(true);
          setLoading(false);
        } else {
          setAuthToken(result.token);
          localStorage.setItem("user_id", result.user_id);
          await refreshUser();
          toast.success("Bentornato!");
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("Google auth error:", err);
        toast.error(err.message || "Errore autenticazione Google");
        navigate("/login", { replace: true });
      }
    };

    processCallback();
  }, [navigate, refreshUser]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Inserisci il numero di telefono");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authAPI.googleComplete(sessionId, trimmed);
      setAuthToken(result.token);
      localStorage.setItem("user_id", result.user_id);
      await refreshUser();
      toast.success("Account creato! Benvenuto in myUup.com");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Google complete error:", err);
      toast.error(err.message || "Errore durante la registrazione");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-[#2B7AB8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#6B7280]">Accesso con Google in corso...</p>
        </div>
      </div>
    );
  }

  if (needsPhone) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#2B7AB8] opacity-5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-md mx-auto mt-12">
          {googleData?.google_picture && (
            <div className="flex justify-center mb-6">
              <img
                src={googleData.google_picture}
                alt=""
                className="w-16 h-16 rounded-full border-2 border-[#2B7AB8]/20"
              />
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-bold mb-2 text-[#1A1A1A]">
              Quasi fatto!
            </h1>
            <p className="text-[#6B7280]">
              Ciao <span className="font-medium text-[#1A1A1A]">{googleData?.google_name}</span>,
              inserisci il tuo numero di telefono per completare la registrazione.
            </p>
          </div>

          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#1A1A1A]">
                Numero di Telefono
              </Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+39 333 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl pl-12 text-[#1A1A1A]"
                  data-testid="google-phone-input"
                  autoFocus
                />
              </div>
              <p className="text-xs text-[#6B7280]">
                Il numero di telefono serve per la sicurezza del tuo account
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold text-white"
              data-testid="google-phone-submit-btn"
            >
              {submitting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Completa Registrazione"
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
