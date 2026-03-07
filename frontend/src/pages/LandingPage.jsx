import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Wallet, Users, Bell, ArrowRight, Download, Share, Plus, MoreVertical, Percent } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    if (!standalone) {
      setShowInstall(true);
    }
    
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
    } else {
      setShowInstructions(true);
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#2B7AB8] opacity-5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 px-6 py-12 max-w-lg mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-16 justify-center">
          <img 
            src="/logo.png" 
            alt="myUup.com" 
            className="h-20 w-auto"
          />
        </div>

        {/* Hero */}
        <div className="mb-12 animate-slideUp text-center">
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold leading-tight mb-4 text-[#1A1A1A]">
            Paga. Guadagna.<br />
            <span className="text-[#E85A24]">Unisciti.</span>
          </h1>
          <p className="text-[#6B7280] text-lg">
            Pagamenti P2P istantanei, marketplace merchant e ricompense per ogni notifica che ricevi.
          </p>
        </div>

        {/* Install Banner + Cashback */}
        {showInstall && !isStandalone && (
          <div className="mb-8 animate-slideUp space-y-3" style={{ animationDelay: '0.1s' }}>
            <button 
              className="install-banner w-full text-left" 
              onClick={handleInstall}
              data-testid="install-banner"
            >
              <div className="flex items-center gap-3 flex-1">
                <Download className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Installa myUup.com</p>
                  <p className="text-sm opacity-80">
                    Tocca per aggiungere alla Home
                  </p>
                </div>
              </div>
              <span className="bg-white text-[#2B7AB8] px-4 py-2 rounded-full font-semibold text-sm flex-shrink-0">
                Installa
              </span>
            </button>

            {/* Cashback promo */}
            <div className="bg-gradient-to-r from-[#E85A24]/5 to-[#2B7AB8]/5 border border-[#E85A24]/15 rounded-2xl p-4" data-testid="cashback-promo">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-[#E85A24]" />
                <span className="text-sm font-bold text-[#E85A24]">Cashback fino al 15%</span>
              </div>
              <p className="text-xs text-[#6B7280] mb-3">Acquista dai tuoi brand preferiti e ricevi UP indietro</p>
              <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {["Amazon", "Nike", "Zalando", "H&M", "MediaWorld", "Esselunga", "IKEA", "Unieuro"].map(brand => (
                  <span 
                    key={brand} 
                    className="flex-shrink-0 bg-white border border-black/8 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-[#1A1A1A] shadow-sm"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          {features.map((f, i) => (
            <div 
              key={f.title}
              className="bg-[#F5F5F5] border border-black/5 rounded-2xl p-5 animate-slideUp"
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              <f.icon className="w-8 h-8 text-[#2B7AB8] mb-3" />
              <h3 className="font-semibold mb-1 text-[#1A1A1A]">{f.title}</h3>
              <p className="text-sm text-[#6B7280]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-4 animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <Button 
            onClick={() => navigate("/register")}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold text-white glow-primary"
            data-testid="get-started-btn"
          >
            Inizia Ora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button 
            onClick={() => navigate("/login")}
            variant="outline"
            className="w-full h-14 rounded-full border-[#2B7AB8]/30 bg-transparent hover:bg-[#2B7AB8]/5 text-lg text-[#2B7AB8]"
            data-testid="login-btn"
          >
            Ho già un account
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-[#6B7280] text-sm mt-12">
          Unisciti a migliaia di utenti che usano myUup.com ogni giorno
        </p>
      </div>

      {/* Install Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="bg-white border-black/10 text-[#1A1A1A] max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Installa myUup.com</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isIOS ? (
              <>
                <p className="text-[#6B7280]">Per installare myUup.com su iPhone/iPad:</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#F5F5F5] p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#2B7AB8]/10 flex items-center justify-center">
                      <Share className="w-5 h-5 text-[#2B7AB8]" />
                    </div>
                    <div>
                      <p className="font-medium">1. Tocca Condividi</p>
                      <p className="text-sm text-[#6B7280]">L'icona in basso al centro</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-[#F5F5F5] p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#E85A24]/10 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-[#E85A24]" />
                    </div>
                    <div>
                      <p className="font-medium">2. Aggiungi a Home</p>
                      <p className="text-sm text-[#6B7280]">Scorri e seleziona l'opzione</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[#6B7280]">Per installare myUup.com:</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#F5F5F5] p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#2B7AB8]/10 flex items-center justify-center">
                      <MoreVertical className="w-5 h-5 text-[#2B7AB8]" />
                    </div>
                    <div>
                      <p className="font-medium">1. Apri il menu</p>
                      <p className="text-sm text-[#6B7280]">Tocca ⋮ in alto a destra</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-[#F5F5F5] p-3 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#E85A24]/10 flex items-center justify-center">
                      <Download className="w-5 h-5 text-[#E85A24]" />
                    </div>
                    <div>
                      <p className="font-medium">2. Installa app</p>
                      <p className="text-sm text-[#6B7280]">Seleziona "Installa app" o "Aggiungi a Home"</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            <Button 
              onClick={() => setShowInstructions(false)}
              className="w-full mt-4 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-white"
            >
              Ho capito
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
