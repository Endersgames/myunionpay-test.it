import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { QrCode, Wallet, Users, Bell, ArrowRight, Download } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Check if on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    // Show install banner if not standalone
    if (!standalone) {
      setShowInstall(true);
    }
    
    // Android/Chrome install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowInstall(false);
      }
      setDeferredPrompt(null);
    }
  };

  const features = [
    { icon: QrCode, title: "Pagamenti QR", desc: "Paga e ricevi denaro con un semplice scan" },
    { icon: Wallet, title: "Wallet Digitale", desc: "Gestisci il tuo saldo in tempo reale" },
    { icon: Users, title: "Guadagna UP", desc: "Invita amici e accumula punti" },
    { icon: Bell, title: "Notifiche Reward", desc: "Ricevi soldi dai merchant per ogni notifica" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] overflow-hidden">
      {/* Glow effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#7C3AED] opacity-10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 px-6 py-12 max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-16">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center glow-primary">
            <span className="font-heading text-xl font-bold">UP</span>
          </div>
          <span className="font-heading text-2xl font-bold">UpPay</span>
        </div>

        {/* Hero */}
        <div className="mb-12 animate-slideUp">
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
            Pay. Earn.<br />
            <span className="text-[#CCFF00]">Level Up.</span>
          </h1>
          <p className="text-[#A1A1AA] text-lg">
            Pagamenti P2P istantanei, marketplace merchant e ricompense per ogni notifica che ricevi.
          </p>
        </div>

        {/* Install Banner */}
        {showInstall && !isStandalone && (
          <div 
            className="install-banner mb-8 animate-slideUp cursor-pointer" 
            style={{ animationDelay: '0.1s' }}
            onClick={deferredPrompt ? handleInstall : undefined}
            data-testid="install-banner"
          >
            <div className="flex items-center gap-3 flex-1">
              <Download className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Installa UpPay</p>
                <p className="text-sm opacity-80">
                  {isIOS 
                    ? "Tocca ⬆️ Condividi → Aggiungi a Home" 
                    : deferredPrompt 
                      ? "Tocca per installare l'app"
                      : "Menu ⋮ → Installa app"}
                </p>
              </div>
            </div>
            {deferredPrompt && (
              <Button 
                onClick={(e) => { e.stopPropagation(); handleInstall(); }}
                variant="secondary"
                className="bg-white text-[#7C3AED] hover:bg-white/90 flex-shrink-0"
                data-testid="install-pwa-btn"
              >
                Installa
              </Button>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          {features.map((f, i) => (
            <div 
              key={f.title}
              className="bg-[#121212] border border-white/5 rounded-2xl p-5 animate-slideUp"
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              <f.icon className="w-8 h-8 text-[#7C3AED] mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-[#A1A1AA]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-4 animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <Button 
            onClick={() => navigate("/register")}
            className="w-full h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-lg font-semibold glow-primary"
            data-testid="get-started-btn"
          >
            Inizia Ora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button 
            onClick={() => navigate("/login")}
            variant="outline"
            className="w-full h-14 rounded-full border-white/20 bg-transparent hover:bg-white/5 text-lg"
            data-testid="login-btn"
          >
            Ho già un account
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-[#A1A1AA] text-sm mt-12">
          Unisciti a migliaia di utenti che usano UpPay ogni giorno
        </p>
      </div>
    </div>
  );
}
