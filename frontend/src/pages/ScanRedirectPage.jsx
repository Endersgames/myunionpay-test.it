import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { Loader2 } from "lucide-react";

/**
 * Smart QR Landing Page
 * - If user is logged in → redirect to payment page
 * - If user is NOT logged in → redirect to register with referral
 */
export default function ScanRedirectPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const handleRedirect = async () => {
      try {
        // Get user/merchant info from QR code
        const response = await axios.get(`${API}/payments/user/${qrCode}`);
        const qrOwner = response.data;

        if (user) {
          // User is logged in → go to payment
          navigate(`/pay/${qrCode}`, { replace: true });
        } else {
          // User not logged in → get referral code and go to register
          const referralResponse = await axios.get(`${API}/qr/referral/${qrCode}`);
          const referralCode = referralResponse.data.referral_code;
          navigate(`/register?ref=${referralCode}&redirect=/pay/${qrCode}`, { replace: true });
        }
      } catch (err) {
        console.error("QR redirect error:", err);
        // QR not found or error → go to home
        if (user) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
      setChecking(false);
    };

    handleRedirect();
  }, [qrCode, user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center mb-6 glow-primary">
        <span className="font-heading text-2xl font-bold">UP</span>
      </div>
      <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mb-4" />
      <p className="text-[#A1A1AA]">Caricamento...</p>
    </div>
  );
}
