import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { QrCode, Wallet, Users, Bell, ArrowRight, Percent } from "lucide-react";
import { getBackendBase } from "@/lib/runtime-config";

const MYU_TEXTS = [
  "Ti porto tra cashback, locali e novita da scoprire.",
  "Registrati e andiamo a vedere che c'e di nuovo.",
  "Se salta fuori qualcosa di curioso, te lo faccio notare io.",
  "Prima entri, poi ti tengo tutto a portata di tap.",
];

export default function LandingPage() {
  const apiBase = getBackendBase();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [myuVisible, setMyuVisible] = useState(false);
  const [myuTextIdx, setMyuTextIdx] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const myuTimer = setTimeout(() => setMyuVisible(true), 1000);
    const textTimer = setInterval(() => setMyuTextIdx(prev => (prev + 1) % MYU_TEXTS.length), 4000);
    return () => { clearTimeout(myuTimer); clearInterval(textTimer); };
  }, []);

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

        {/* MYU Mascot */}
        {myuVisible && (
          <div className="mb-8 animate-slideUp" style={{ animationDelay: '0.1s' }} data-testid="myu-landing-section">
            <div className="flex items-start gap-3">
              {/* MYU avatar */}
              <div
                className="flex-shrink-0 w-14 h-14 rounded-full overflow-hidden shadow-lg border-2 border-white"
                style={{ animation: "myuBounce 2s ease infinite" }}
              >
                <img src="/myu-icon.png" alt="MYU" className="w-full h-full object-cover" />
              </div>
              {/* Speech bubble */}
              <div
                className="flex-1 bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-black/5"
                style={{ animation: "myuFadeIn 0.5s ease" }}
                data-testid="myu-landing-bubble"
              >
                <p className="text-base font-bold text-[#1A1A1A] mb-1">Ciao, mi chiamo MYU!</p>
                <p className="text-sm text-[#6B7280] leading-snug mb-3" key={myuTextIdx} style={{ animation: "myuFadeIn 0.4s ease" }}>
                  {MYU_TEXTS[myuTextIdx]}
                </p>
                <p className="text-xs text-[#2B7AB8] font-medium">Entriamo e poi ti accompagno io.</p>
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
                  <img src={`${apiBase}${b.logo}`} alt={b.brand} className="w-full h-full object-contain p-1" />
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
    </div>
  );
}
