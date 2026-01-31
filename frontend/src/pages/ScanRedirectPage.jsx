import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Smart QR Landing Page
 * - If user is logged in → redirect to payment page
 * - If user is NOT logged in → redirect to register with referral
 */
export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading, token } = useAuth();
  const [error, setError] = useState(null);
  const [recipientName, setRecipientName] = useState("");

  useEffect(() => {
    if (authLoading) return;

    const handleRedirect = async () => {
      try {
        // Get user/merchant info from QR code
        const response = await axios.get(`${API}/payments/user/${qrCode}`);
        const qrOwner = response.data;
        setRecipientName(qrOwner.name);

        if (user && token) {
          // User is logged in → go directly to payment
          // Small delay to ensure token is valid
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
  }, [qrCode, user, token, authLoading, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FF3B30]/20 flex items-center justify-center mb-6">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">Errore</h2>
        <p className="text-[#A1A1AA] text-center mb-6">{error}</p>
        <Button
          onClick={() => navigate("/")}
          className="rounded-full bg-[#7C3AED] hover:bg-[#6D28D9]"
        >
          Torna alla Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center mb-6 glow-primary">
        <span className="font-heading text-2xl font-bold">UP</span>
      </div>
      <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mb-4" />
      {recipientName ? (
        <p className="text-white text-lg mb-2">Pagamento a <span className="text-[#CCFF00]">{recipientName}</span></p>
      ) : (
        <p className="text-[#A1A1AA]">Caricamento...</p>
      )}
      <p className="text-[#A1A1AA] text-sm">Preparazione pagamento...</p>
    </div>
  );
}
