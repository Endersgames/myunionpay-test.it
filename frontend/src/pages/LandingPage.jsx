import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Wallet, Users, Bell, ArrowRight, Download, Share, Plus, MoreVertical, Percent } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || "";

const MYU_BUBBLES = [
  "Ehi! Installa myUup sulla Home per accesso veloce!",
  "Cashback su Amazon, IKEA, Decathlon... installa e scopri!",
  "Tocca qui per installarmi! Ci metto un attimo.",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [myuBubbleIdx, setMyuBubbleIdx] = useState(0);
  const [myuVisible, setMyuVisible] = useState(false);

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
    
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // MYU appears after 1.5s
    const myuTimer = setTimeout(() => setMyuVisible(true), 1500);
    // Cycle bubbles every 5s
    const bubbleTimer = setInterval(() => {
      setMyuBubbleIdx(prev => (prev + 1) % MYU_BUBBLES.length);
    }, 5000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(myuTimer);
      clearInterval(bubbleTimer);
    };
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

        {/* MYU Mascot + Install CTA */}
        {!isStandalone && myuVisible && (
          <div className="mb-8 animate-slideUp" style={{ animationDelay: '0.1s' }} data-testid="myu-landing-section">
            <div className="flex items-end gap-3">
              {/* MYU avatar */}
              <button
                onClick={handleInstall}
                className="flex-shrink-0 w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white hover:scale-105 transition-transform"
                data-testid="myu-landing-avatar"
                style={{ animation: "myuBounce 2s ease infinite" }}
              >
                <img src="/myu-icon.png" alt="MYU" className="w-full h-full object-cover" />
              </button>
              {/* Speech bubble */}
              <div
                className="flex-1 bg-white rounded-2xl rounded-bl-sm p-3 shadow-md border border-black/5 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={handleInstall}
                data-testid="myu-landing-bubble"
                style={{ animation: "myuFadeIn 0.4s ease" }}
                key={myuBubbleIdx}
              >
                <p className="text-sm font-medium text-[#1A1A1A] leading-snug">
                  {MYU_BUBBLES[myuBubbleIdx]}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 bg-[#2B7AB8] text-white text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-[#236699] transition-colors">
                    <Download className="w-3 h-3" />
                    Installa
                  </span>
                  <span className="text-[10px] text-[#6B7280]">1 tap</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brand Cashback Strip */}
        <div className="mb-8 animate-slideUp" style={{ animationDelay: '0.15s' }} data-testid="brand-cashback-strip">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Percent className="w-4 h-4 text-[#E85A24]" />
            <span className="text-sm font-bold text-[#1A1A1A]">Cashback sui tuoi brand</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { brand: "Amazon", cashback: "1.87%", color: "#232F3E", logo: "/api/giftcards/logo/986ef34a-13b7-4250-9414-905c982c75b7.JPG" },
              { brand: "IKEA", cashback: "6.5%", color: "#0058A3", logo: "/api/giftcards/logo/1aa843df-62b9-45d3-9365-cd11ef930443.JPG" },
              { brand: "Conad", cashback: "1.69%", color: "#D9D9D9", logo: "/api/giftcards/logo/bcddd511-c663-4175-b959-2cebdccaf9cd.JPG" },
              { brand: "Decathlon", cashback: "1%", color: "#333", logo: "/api/giftcards/logo/62091058-c72f-4759-828f-5642bcfe2c73.JPG" },
            ].map(b => (
              <div key={b.brand} className="bg-white rounded-xl border border-black/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`brand-${b.brand.toLowerCase()}`}>
                <div className="aspect-[4/3] overflow-hidden bg-[#FAFAFA]">
                  <img src={`${API}${b.logo}`} alt={b.brand} className="w-full h-full object-contain p-1" />
                </div>
                <div className="px-1.5 py-1 text-center border-t border-black/5">
                  <span className="text-[10px] font-bold text-[#E85A24]">{b.cashback}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          {features.map((f, i) => (
            <div 
              key={f.title}
              className="bg-[#F5F5F5] border border-black/5 rounded-2xl p-5 animate-slideUp"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
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
