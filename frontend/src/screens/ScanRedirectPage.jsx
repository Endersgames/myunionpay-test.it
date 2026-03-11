import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import {
  ArrowRight,
  Store,
  UtensilsCrossed,
  Gift,
  Menu as MenuIcon,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { featuresAPI, paymentAPI } from "@/lib/api";
import { getBackendBase } from "@/lib/runtime-config";

const MYU_MESSAGES = {
  merchant: [
    "Che c'e di nuovo qui dentro?",
    "Fammi vedere se ci sono piatti nuovi.",
    "Tutte cose buone, eh?",
    "Se c'e qualcosa di piu leggero, meglio ancora.",
  ],
  user: [
    "Controlla il nome e poi andiamo lisci.",
    "Un attimo e ti porto al passaggio giusto.",
    "Meglio due secondi di check che un click storto.",
  ],
  error: [
    "Qui qualcosa non torna.",
    "Questo QR oggi non collabora. Torniamo alla Home?",
  ],
};

const BRAND_LOGOS = [
  { brand: "Amazon", cashback: "1.87%", logo: "/api/giftcards/logo/986ef34a-13b7-4250-9414-905c982c75b7.JPG" },
  { brand: "IKEA", cashback: "6.5%", logo: "/api/giftcards/logo/1aa843df-62b9-45d3-9365-cd11ef930443.JPG" },
  { brand: "Conad", cashback: "1.69%", logo: "/api/giftcards/logo/bcddd511-c663-4175-b959-2cebdccaf9cd.JPG" },
  { brand: "Decathlon", cashback: "1%", logo: "/api/giftcards/logo/62091058-c72f-4759-828f-5642bcfe2c73.JPG" },
];

function BrandBanner() {
  const apiBase = getBackendBase();

  return (
    <div className="mt-6 pt-4 border-t border-black/5" data-testid="brand-cashback-banner">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Percent className="w-3.5 h-3.5 text-[#E85A24]" />
        <span className="text-xs font-bold text-[#1A1A1A]">Cashback sui tuoi brand</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {BRAND_LOGOS.map(b => (
          <div key={b.brand} className="bg-white rounded-xl border border-black/5 overflow-hidden shadow-sm">
            <div className="aspect-[4/3] overflow-hidden bg-[#FAFAFA]">
              <img src={`${apiBase}${b.logo}`} alt={b.brand} className="w-full h-full object-contain p-1" />
            </div>
            <div className="px-1 py-0.5 text-center border-t border-black/5">
              <span className="text-[9px] font-bold text-[#E85A24]">{b.cashback}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState("user");
  const [referralCode, setReferralCode] = useState("");
  const [merchantData, setMerchantData] = useState(null);
  const [myuTextIdx, setMyuTextIdx] = useState(0);
  const [pricing, setPricing] = useState({});
  const referrerBonus = Number(pricing?.referral_bonus_referrer ?? 1);
  const referredBonus = Number(pricing?.referral_bonus_referred ?? referrerBonus);

  useEffect(() => {
    const textTimer = setInterval(() => setMyuTextIdx(prev => prev + 1), 4500);
    return () => clearInterval(textTimer);
  }, []);

  useEffect(() => {
    const fetchRecipient = async () => {
      try {
        const qrOwner = await paymentAPI.getReferralFromQR(qrCode);
        if (qrOwner) {
          setRecipientName(qrOwner.name);
          setRecipientType(qrOwner.type || "user");
          setReferralCode(qrOwner.referral_code || "");
          if (qrOwner.type === "merchant" && qrOwner.merchant_id) {
            setMerchantData({
              id: qrOwner.merchant_id,
              business_name: qrOwner.name,
              category: qrOwner.merchant_category || "",
              address: qrOwner.merchant_address || "",
              qr_code: qrCode,
              referral_code: qrOwner.referral_code || "",
            });
          }
        } else { setError("QR Code non valido"); }
      } catch { setError("QR Code non valido"); }
    };
    fetchRecipient();
  }, [qrCode]);

  useEffect(() => {
    featuresAPI.getPublicPricing().then((data) => setPricing(data || {})).catch(() => {});
  }, []);

  const resolvedReferralCode = referralCode || merchantData?.referral_code || qrCode;
  const buildRegisterUrl = (redirectPath) => {
    const params = new URLSearchParams();
    if (resolvedReferralCode) params.set("ref", resolvedReferralCode);
    if (redirectPath) params.set("redirect", redirectPath);
    return `/register?${params.toString()}`;
  };
  const buildMenuUrl = (merchantId) => {
    const params = new URLSearchParams();
    if (resolvedReferralCode) params.set("ref", resolvedReferralCode);
    return params.toString() ? `/menu/${merchantId}?${params.toString()}` : `/menu/${merchantId}`;
  };

  const handleContinue = () => {
    if (authLoading) return;
    if (user) navigate(`/pay/${qrCode}`, { replace: true });
    else navigate(buildRegisterUrl(`/pay/${qrCode}`), { replace: true });
  };

  const handleViewMenu = () => merchantData && navigate(buildMenuUrl(merchantData.id));
  const handleViewMenuRegister = () => merchantData && navigate(buildRegisterUrl(`/menu/${merchantData.id}`));
  const handleRegisterAndPay = () => navigate(buildRegisterUrl(`/pay/${qrCode}`));

  const getMyuMsg = (type) => {
    const msgs = MYU_MESSAGES[type] || MYU_MESSAGES.user;
    return msgs[myuTextIdx % msgs.length];
  };

  // --- MYU Bubble ---
  const MyuBubble = ({ type }) => (
    <div className="flex items-start gap-3 mb-5" data-testid="myu-qr-bubble">
      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden shadow-md border-2 border-white" style={{ animation: "myuBounce 2s ease infinite" }}>
        <img src="/myu-icon.png" alt="MYU" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-black/5" style={{ animation: "myuFadeIn 0.5s ease" }}>
        <p className="text-xs font-bold text-[#1A1A1A] mb-0.5">Ciao, sono MYU!</p>
        <p className="text-[11px] text-[#6B7280] leading-snug">
          {getMyuMsg(type)}
        </p>
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

  // --- MERCHANT QR ---
  if (recipientType === "merchant" && merchantData) {
    const isLoggedIn = !!user;
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col px-5 py-6" data-testid="qr-merchant-landing">
        {/* Merchant Header */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E85A24] to-[#D14E1A] flex items-center justify-center mx-auto mb-2 shadow-lg">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-bold text-xl text-[#1A1A1A]">{recipientName}</h1>
          <p className="text-xs text-[#6B7280]">{merchantData.category}</p>
          {merchantData.address && <p className="text-[10px] text-[#9CA3AF] mt-0.5">{merchantData.address}</p>}
        </div>

        <MyuBubble type="merchant" />

        {/* Actions */}
        <div className="flex-1 space-y-3">
          {isLoggedIn ? (
            <>
              <button onClick={handleViewMenu} className="w-full bg-white hover:bg-[#F5F5F5] rounded-2xl p-4 text-left border border-black/5 transition-colors" data-testid="qr-view-menu">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center"><MenuIcon className="w-5 h-5 text-[#2B7AB8]" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1A1A1A]">Visualizza il Menu</p>
                    <p className="text-[11px] text-[#6B7280]">Scopri piatti e offerte</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                </div>
              </button>
              <button onClick={() => navigate(`/pay/${qrCode}`, { replace: true })}
                className="w-full bg-gradient-to-r from-[#E85A24] to-[#D14E1A] rounded-2xl p-4 text-left text-white" data-testid="qr-pay-merchant">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><UtensilsCrossed className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Paga</p>
                    <p className="text-[11px] text-white/80">Paga il merchant direttamente</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/50" />
                </div>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleViewMenu} className="w-full bg-white hover:bg-[#F5F5F5] rounded-2xl p-4 text-left border border-black/5 transition-colors" data-testid="qr-view-menu-only">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#6B7280]/10 flex items-center justify-center"><MenuIcon className="w-5 h-5 text-[#6B7280]" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[#1A1A1A]">Visualizza il Menu</p>
                    <p className="text-[11px] text-[#6B7280]">Scopri piatti e offerte</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF]" />
                </div>
              </button>
              <button onClick={handleViewMenuRegister}
                className="w-full bg-gradient-to-r from-[#2B7AB8] to-[#1E5F8A] rounded-2xl p-4 text-left text-white relative overflow-hidden" data-testid="qr-menu-and-up">
                <span className="absolute top-2.5 right-3 bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  +{referredBonus.toFixed(2)} UP
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><MenuIcon className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Menu + Ottieni {referredBonus.toFixed(2)} UP</p>
                    <p className="text-[11px] text-white/80">Registrati e guadagna il tuo primo UP</p>
                  </div>
                </div>
              </button>
              <button onClick={handleRegisterAndPay}
                className="w-full bg-gradient-to-r from-[#E85A24] to-[#D14E1A] rounded-2xl p-4 text-left text-white relative overflow-hidden" data-testid="qr-register-pay">
                <span className="absolute top-2.5 right-3 bg-white/20 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  +{referredBonus.toFixed(2)} UP
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center"><Gift className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Registrati e Paga</p>
                    <p className="text-[11px] text-white/80">
                      Ottieni {referredBonus.toFixed(2)} UP e paga il merchant
                    </p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Brand Cashback Banner */}
        <BrandBanner />
        <p className="text-center text-[10px] text-[#9CA3AF] mt-4">myUup.com</p>
      </div>
    );
  }

  // --- USER QR ---
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col px-5 py-6" data-testid="qr-user-landing">
      <div className="text-center mb-4">
        <img src="/logo.png" alt="myUup" className="h-14 w-auto mx-auto mb-2" />
      </div>

      {recipientName && (
        <div className="bg-[#E85A24]/5 border border-[#E85A24]/15 rounded-2xl p-3 mb-4 text-center">
          <p className="text-[11px] text-[#6B7280]">Stai per pagare</p>
          <p className="text-lg font-bold text-[#E85A24]">{recipientName}</p>
        </div>
      )}

      <MyuBubble type="user" />

      <div className="flex-1" />

      {/* Actions */}
      <div className="space-y-3">
        <Button onClick={handleContinue} variant="outline"
          className="w-full h-12 rounded-full border-black/10 text-[#1A1A1A]" data-testid="qr-continue-btn">
          {user ? "Continua al pagamento" : "Registrati e continua"} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Brand Cashback Banner */}
      <BrandBanner />
      <p className="text-center text-[10px] text-[#9CA3AF] mt-3">myUup.com</p>
    </div>
  );
}
