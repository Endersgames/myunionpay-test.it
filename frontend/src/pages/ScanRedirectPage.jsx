import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import { Download, Smartphone, CheckCircle, ArrowRight, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// API
import { paymentAPI } from "@/lib/api";

/**
 * Smart QR Landing Page with Strong PWA Install Prompt
 * - Prompts to install the app before proceeding
 * - If user is logged in → redirect to payment page
 * - If user is NOT logged in → redirect to register with referral
 */
export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState("");
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const deferredPromptRef = useRef(null);

  // Check if already installed or can be installed
  useEffect(() => {
    // Check if running as installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    setIsInstalled(isStandalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      if (!isStandalone) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If not installed and not iOS with deferred prompt, show install
    if (!isStandalone) {
      // Small delay to check for install prompt
      setTimeout(() => {
        if (!deferredPromptRef.current && iOS) {
          setShowInstallPrompt(true);
        } else if (!deferredPromptRef.current) {
          // Android/Desktop without prompt - maybe already installable
          setShowInstallPrompt(true);
        }
      }, 500);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Fetch recipient info
  useEffect(() => {
    const fetchRecipient = async () => {
      try {
        const qrOwner = await paymentAPI.getReferralFromQR(qrCode);
        if (qrOwner) {
          setRecipientName(qrOwner.name);
        } else {
          setError("QR Code non valido");
        }
      } catch (err) {
        console.error("QR error:", err);
        setError("QR Code non valido");
      }
    };
    fetchRecipient();
  }, [qrCode]);

  // Handle install click
  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallPrompt(false);
      }
      deferredPromptRef.current = null;
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  // Proceed to app
  const handleContinue = () => {
    if (authLoading) return;
    
    if (user) {
      navigate(`/pay/${qrCode}`, { replace: true });
    } else {
      navigate(`/register?ref=${qrCode}&redirect=/pay/${qrCode}`, { replace: true });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] flex flex-col items-center justify-center px-6 text-white">
        <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
          <span className="text-4xl">❌</span>
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2">QR Non Valido</h2>
        <p className="text-white/60 text-center mb-6">{error}</p>
        <Button
          onClick={() => navigate("/")}
          className="rounded-full bg-[#2B7AB8] hover:bg-[#236699]"
        >
          Vai alla Home
        </Button>
      </div>
    );
  }

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] flex flex-col px-6 py-8 text-white">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-[#2B7AB8] flex items-center justify-center mb-6">
            <Smartphone className="w-10 h-10" />
          </div>
          <h2 className="font-heading text-2xl font-bold mb-2 text-center">Installa Myunionpaytest.it</h2>
          <p className="text-white/60 text-center mb-8">Segui questi semplici passi:</p>
          
          <div className="w-full max-w-sm space-y-4">
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#2B7AB8] flex items-center justify-center font-bold">1</div>
              <div className="flex-1">
                <p className="font-medium">Tocca l'icona Condividi</p>
                <div className="flex items-center gap-2 mt-1">
                  <Share className="w-5 h-5 text-[#2B7AB8]" />
                  <span className="text-sm text-white/60">in basso nella barra di Safari</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#E85A24] flex items-center justify-center font-bold">2</div>
              <div className="flex-1">
                <p className="font-medium">Scorri e tocca</p>
                <div className="flex items-center gap-2 mt-1">
                  <Plus className="w-5 h-5 text-[#E85A24]" />
                  <span className="text-sm text-white/60">"Aggiungi a Home"</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center font-bold">3</div>
              <div className="flex-1">
                <p className="font-medium">Conferma toccando "Aggiungi"</p>
                <span className="text-sm text-white/60">L'app apparirà sulla tua Home</span>
              </div>
            </div>
          </div>
        </div>
        
        <Button
          onClick={() => setShowIOSInstructions(false)}
          variant="outline"
          className="w-full h-14 rounded-full border-white/30 text-white hover:bg-white/10 mt-6"
        >
          Ho capito, continua
        </Button>
      </div>
    );
  }

  // Main Install Prompt Screen
  if (showInstallPrompt && !isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] flex flex-col px-6 py-8 text-white">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <img src="/logo.png" alt="UP" className="h-14 w-auto" />
          </div>
          <h1 className="font-heading text-3xl font-bold mb-2">Myunionpaytest.it</h1>
          <p className="text-white/60">Paga. Guadagna. Unisciti.</p>
        </div>

        {/* Recipient Info */}
        {recipientName && (
          <div className="bg-[#E85A24]/20 border border-[#E85A24]/30 rounded-2xl p-4 mb-6 text-center">
            <p className="text-white/70 text-sm">Stai per pagare</p>
            <p className="text-xl font-bold text-[#E85A24]">{recipientName}</p>
          </div>
        )}

        {/* Install Benefits */}
        <div className="flex-1">
          <h2 className="font-semibold text-lg mb-4 text-center">Installa l'app per continuare</h2>
          
          <div className="space-y-3">
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2B7AB8]/30 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-[#2B7AB8]" />
              </div>
              <div>
                <p className="font-medium">Accesso Rapido</p>
                <p className="text-sm text-white/60">Apri l'app dalla Home del telefono</p>
              </div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E85A24]/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#E85A24]" />
              </div>
              <div>
                <p className="font-medium">Pagamenti Sicuri</p>
                <p className="text-sm text-white/60">Paga con QR code in modo sicuro</p>
              </div>
            </div>
            
            <div className="bg-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/30 flex items-center justify-center">
                <Download className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Funziona Offline</p>
                <p className="text-sm text-white/60">Usa l'app anche senza connessione</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-6">
          <Button
            onClick={handleInstall}
            className="w-full h-14 rounded-full bg-[#E85A24] hover:bg-[#D14E1A] text-lg font-semibold"
          >
            <Download className="w-5 h-5 mr-2" />
            Installa Gratis e guadagna +1 UP
          </Button>
          
          <Button
            onClick={handleContinue}
            variant="outline"
            className="w-full h-14 rounded-full border-white/30 text-white hover:bg-white/10"
          >
            Continua nel browser
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
        
        <p className="text-center text-xs text-white/40 mt-4">
          Nessun download da store • Installazione istantanea • 0 MB di spazio
        </p>
      </div>
    );
  }

  // Loading / Redirect state
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] flex flex-col items-center justify-center px-6 text-white">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] flex items-center justify-center mb-6 animate-pulse">
        <img src="/logo.png" alt="UP" className="h-12 w-auto" />
      </div>
      
      {recipientName ? (
        <>
          <p className="text-white/60 mb-2">Pagamento a</p>
          <p className="text-2xl font-bold text-[#E85A24] mb-4">{recipientName}</p>
        </>
      ) : (
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin mb-4" />
      )}
      
      <p className="text-white/60 text-sm">Caricamento...</p>
      
      {/* Auto-continue after short delay if already installed */}
      {isInstalled && recipientName && (
        <Button
          onClick={handleContinue}
          className="mt-6 rounded-full bg-[#2B7AB8] hover:bg-[#236699]"
        >
          Continua al pagamento
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}
