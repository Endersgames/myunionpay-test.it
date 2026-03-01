import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// API
import { paymentAPI } from "@/lib/api";

/**
 * Smart QR Landing Page
 * - If user is logged in → redirect to payment page
 * - If user is NOT logged in → redirect to register with referral
 */
export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState("");

  useEffect(() => {
    if (authLoading) return;

    const handleRedirect = async () => {
      try {
        // Get user info from QR code
        const qrOwner = await paymentAPI.getReferralFromQR(qrCode);
        
        if (!qrOwner) {
          setError("QR Code non valido o scaduto");
          return;
        }
        
        setRecipientName(qrOwner.name);

        if (user) {
          // User is logged in → go directly to payment
          setTimeout(() => {
            navigate(`/pay/${qrCode}`, { replace: true });
          }, 100);
        } else {
          // User not logged in → get referral code and go to register
          const referralCode = qrOwner.referral_code || "";
          navigate(`/register?ref=${referralCode}&redirect=/pay/${qrCode}`, { replace: true });
        }
      } catch (err) {
        console.error("QR redirect error:", err);
        setError("QR Code non valido o scaduto");
      }
    };

    handleRedirect();
  }, [qrCode, user, authLoading, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FF3B30]/20 flex items-center justify-center mb-6">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="font-heading text-xl font-bold mb-2 text-[#1A1A1A]">Errore</h2>
        <p className="text-[#6B7280] text-center mb-6">{error}</p>
        <Button
          onClick={() => navigate("/")}
          className="rounded-full bg-[#2B7AB8] hover:bg-[#236699]"
        >
          Torna alla Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] flex items-center justify-center mb-6 glow-primary">
        <img src="/logo.png" alt="Myunionpaytest.it" className="h-10 w-auto" />
      </div>
      <Loader2 className="w-8 h-8 text-[#2B7AB8] animate-spin mb-4" />
      {recipientName ? (
        <p className="text-[#1A1A1A] text-lg mb-2">Pagamento a <span className="text-[#E85A24]">{recipientName}</span></p>
      ) : (
        <p className="text-[#6B7280]">Caricamento...</p>
      )}
      <p className="text-[#6B7280] text-sm">Preparazione pagamento...</p>
    </div>
  );
}
