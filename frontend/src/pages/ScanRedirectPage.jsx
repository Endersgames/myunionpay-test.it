import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import {
  Download, ArrowRight, Share, Plus, Smartphone,
  Store, UtensilsCrossed, Gift, Menu as MenuIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentAPI } from "@/lib/api";

const MYU_MESSAGES = {
  merchant: [
    "Questo locale ha cashback e offerte! Installa e scopri tutto.",
    "Registrati e guadagna subito 1 UP gratis!",
  ],
  menu: [
    "Guarda che menu! Registrati per ottenere 1 UP.",
    "Cashback anche qui! Installa e inizia a risparmiare.",
  ],
  user: [
    "Paga in un attimo e guadagna UP!",
    "Installa myUup e risparmia su oltre 1000 brand.",
  ],
  error: ["Ops, questo QR non funziona. Torna alla Home!"],
};

export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState("user");
  const [merchantData, setMerchantData] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [myuTextIdx, setMyuTextIdx] = useState(0);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsInstalled(isStandalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);

    const handler = (e) => { e.preventDefault(); deferredPromptRef.current = e; };
    window.addEventListener('beforeinstallprompt', handler);

    const textTimer = setInterval(() => setMyuTextIdx(prev => prev + 1), 4500);
    return () => { window.removeEventListener('beforeinstallprompt', handler); clearInterval(textTimer); };
  }, []);

  useEffect(() => {
    const fetchRecipient = async () => {
      try {
        const qrOwner = await paymentAPI.getReferralFromQR(qrCode);
        if (qrOwner) {
          setRecipientName(qrOwner.name);
          setRecipientType(qrOwner.type || "user");
          if (qrOwner.type === "merchant" && qrOwner.merchant_id) {
            setMerchantData({
              id: qrOwner.merchant_id, business_name: qrOwner.name,
              category: qrOwner.merchant_category || "", address: qrOwner.merchant_address || "", qr_code: qrCode,
            });
          }
        } else { setError("QR Code non valido"); }
      } catch { setError("QR Code non valido"); }
    };
    fetchRecipient();
  }, [qrCode]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      if (deferredPromptRef.current) {
        deferredPromptRef.current.prompt();
        const { outcome } = await deferredPromptRef.current.userChoice;
        deferredPromptRef.current = null;
        if (outcome === 'accepted') { setIsInstalled(true); setInstalling(false); return; }
      }
      if ('getInstalledRelatedApps' in navigator) {
        const apps = await navigator.getInstalledRelatedApps();
        if (apps.length > 0) { setIsInstalled(true); setInstalling(false); return; }
      }
      if (isIOS) { setShowIOSInstructions(true); }
    } catch {}
    setInstalling(false);
  };

  const handleContinue = () => {
    if (authLoading) return;
    if (user) navigate(`/pay/${qrCode}`, { replace: true });
    else navigate(`/register?ref=${qrCode}&redirect=/pay/${qrCode}`, { replace: true });
  };

  const handleViewMenu = () => merchantData && navigate(`/menu/${merchantData.id}?ref=${qrCode}`);
  const handleViewMenuRegister = () => merchantData && navigate(`/register?ref=${qrCode}&redirect=/menu/${merchantData.id}`);
  const handleRegisterAndPay = () => navigate(`/register?ref=${qrCode}&redirect=/pay/${qrCode}`);

  const getMyuMsg = (type) => {
    const msgs = MYU_MESSAGES[type] || MYU_MESSAGES.user;
    return msgs[myuTextIdx % msgs.length];
  };

  // --- MYU Bubble Component ---
  const MyuBubble = ({ type }) => (
    <div className="flex items-start gap-3 mb-6" data-testid="myu-qr-bubble">
      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-white" style={{ animation: "myuBounce 2s ease infinite" }}>
        <img src="/myu-icon.png" alt="MYU" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-black/5" style={{ animation: "myuFadeIn 0.5s ease" }}>
        <p className="text-sm font-bold text-[#1A1A1A] mb-0.5">MYU</p>
        <p className="text-xs text-[#6B7280] leading-snug" key={myuTextIdx} style={{ animation: "myuFadeIn 0.4s ease" }}>
          {getMyuMsg(type)}
        </p>
        {!isInstalled && (
          <div className="flex justify-end mt-2">
            <button onClick={handleInstall} disabled={installing}
              className="flex items-center gap-1 bg-[#2B7AB8] hover:bg-[#236699] active:scale-[0.97] text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-70"
              data-testid="myu-qr-install-btn">
              <Download className="w-3 h-3" />
              {installing ? "..." : "Installa Ora"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // --- ERROR ---
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6">
        <MyuBubble type="error" />
        <p className="text-sm text-[#6B7280] mb-4">{error}</p>
        <Button onClick={() => navigate("/")} className="rounded-full bg-[#2B7AB8] hover:bg-[#236699]" data-testid="qr-home-btn">
          Vai alla Home
        </Button>
      </div>
    );
  }

  // --- iOS Instructions ---
  if (showIOSInstructions) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col px-6 py-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#2B7AB8] flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-bold text-xl text-[#1A1A1A] mb-1 text-center">Installa myUup.com</h2>
          <p className="text-sm text-[#6B7280] text-center mb-6">Segui questi passi:</p>
          <div className="w-full max-w-sm space-y-3">
            {[
              { n: "1", icon: Share, color: "#2B7AB8", text: "Tocca Condividi", sub: "in basso in Safari" },
              { n: "2", icon: Plus, color: "#E85A24", text: "Aggiungi a Home", sub: "scorri e tocca" },
              { n: "3", icon: null, color: "#16a34a", text: "Conferma \"Aggiungi\"", sub: "apparira sulla Home" },
            ].map(s => (
              <div key={s.n} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-black/5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: s.color }}>{s.n}</div>
                <div>
                  <p className="font-medium text-sm text-[#1A1A1A]">{s.text}</p>
                  <p className="text-xs text-[#6B7280]">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Button onClick={() => setShowIOSInstructions(false)} variant="outline" className="w-full h-12 rounded-full border-black/10 text-[#1A1A1A] mt-6">
          Ho capito, continua
        </Button>
      </div>
    );
  }

  // --- MERCHANT QR ---
  if (recipientType === "merchant" && merchantData) {
    const isLoggedIn = !!user;
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col px-5 py-6" data-testid="qr-merchant-landing">
        {/* Merchant Header */}
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E85A24] to-[#D14E1A] flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-bold text-xl text-[#1A1A1A]">{recipientName}</h1>
          <p className="text-xs text-[#6B7280]">{merchantData.category}</p>
          {merchantData.address && <p className="text-[10px] text-[#9CA3AF] mt-0.5">{merchantData.address}</p>}
        </div>

        {/* MYU */}
        <MyuBubble type="merchant" />

        {/* Actions */}
        <div className="flex-1 space-y-3">
          {isLoggedIn ? (
            <>
              <button onClick={handleViewMenu} className="w-full bg-white hover:bg-[#F5F5F5] rounded-2xl p-4 text-left border border-black/5 transition-colors" data-testid="qr-view-menu">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
                    <MenuIcon className="w-6 h-6 text-[#2B7AB8]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#1A1A1A]">Visualizza il Menu</p>
                    <p className="text-xs text-[#6B7280]">Scopri piatti e offerte</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                </div>
              </button>
              <button onClick={() => navigate(`/pay/${qrCode}`, { replace: true })}
                className="w-full bg-gradient-to-r from-[#E85A24] to-[#D14E1A] rounded-2xl p-4 text-left text-white" data-testid="qr-pay-merchant">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Paga</p>
                    <p className="text-xs text-white/80">Paga il merchant direttamente</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/50" />
                </div>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleViewMenu} className="w-full bg-white hover:bg-[#F5F5F5] rounded-2xl p-4 text-left border border-black/5 transition-colors" data-testid="qr-view-menu-only">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#6B7280]/10 flex items-center justify-center">
                    <MenuIcon className="w-6 h-6 text-[#6B7280]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#1A1A1A]">Visualizza il Menu</p>
                    <p className="text-xs text-[#6B7280]">Scopri piatti e offerte</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                </div>
              </button>
              <button onClick={handleViewMenuRegister}
                className="w-full bg-gradient-to-r from-[#2B7AB8] to-[#1E5F8A] rounded-2xl p-4 text-left text-white relative overflow-hidden" data-testid="qr-menu-and-up">
                <span className="absolute top-2.5 right-3 bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold">+1 UP</span>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <MenuIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Menu + Ottieni 1 UP</p>
                    <p className="text-xs text-white/80">Registrati e guadagna il tuo primo UP</p>
                  </div>
                </div>
              </button>
              <button onClick={handleRegisterAndPay}
                className="w-full bg-gradient-to-r from-[#E85A24] to-[#D14E1A] rounded-2xl p-4 text-left text-white relative overflow-hidden" data-testid="qr-register-pay">
                <span className="absolute top-2.5 right-3 bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold">+1 UP</span>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Registrati e Paga</p>
                    <p className="text-xs text-white/80">Ottieni 1 UP e paga il merchant</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-[#9CA3AF] mt-6">myUup.com</p>
      </div>
    );
  }

  // --- USER QR ---
  if (!isInstalled) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col px-5 py-6" data-testid="qr-user-landing">
        {/* Logo */}
        <div className="text-center mb-4">
          <img src="/logo.png" alt="myUup" className="h-16 w-auto mx-auto mb-2" />
        </div>

        {/* Recipient */}
        {recipientName && (
          <div className="bg-[#E85A24]/5 border border-[#E85A24]/15 rounded-2xl p-3 mb-4 text-center">
            <p className="text-xs text-[#6B7280]">Stai per pagare</p>
            <p className="text-lg font-bold text-[#E85A24]">{recipientName}</p>
          </div>
        )}

        {/* MYU */}
        <MyuBubble type="user" />

        {/* Actions */}
        <div className="space-y-3 mt-auto">
          <Button onClick={handleInstall} disabled={installing}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-base font-bold" data-testid="qr-install-btn">
            <Download className="w-5 h-5 mr-2" />
            {installing ? "Installazione..." : "Installa e guadagna +1 UP"}
          </Button>
          <Button onClick={handleContinue} variant="outline"
            className="w-full h-12 rounded-full border-black/10 text-[#1A1A1A]" data-testid="qr-continue-btn">
            Continua nel browser <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        <p className="text-center text-[10px] text-[#9CA3AF] mt-4">Installazione istantanea - 0 MB</p>
      </div>
    );
  }

  // --- Loading / Redirect ---
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6">
      <img src="/logo.png" alt="myUup" className="h-16 w-auto mb-4" />
      {recipientName ? (
        <>
          <p className="text-xs text-[#6B7280] mb-1">{recipientType === "merchant" ? "Negozio" : "Pagamento a"}</p>
          <p className="text-xl font-bold text-[#E85A24] mb-4">{recipientName}</p>
        </>
      ) : (
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin mb-4" />
      )}
      {recipientName && (
        <Button onClick={handleContinue} className="rounded-full bg-[#2B7AB8] hover:bg-[#236699]" data-testid="qr-continue-redirect">
          Continua <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}
