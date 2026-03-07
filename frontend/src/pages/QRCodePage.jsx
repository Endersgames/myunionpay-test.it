import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Copy, Share2, QrCode as QrIcon, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import QRCode from "@/components/QRCode";

export default function QRCodePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const qrCode = user?.qr_code || "";
  const qrUrl = `${window.location.origin}/s/${qrCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    toast.success("Link copiato!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "myUup.com - Pagami o Unisciti",
          text: `Scansiona per pagarmi o scarica myUup.com! Codice: ${qrCode}`,
          url: qrUrl
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-white pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2">Il Tuo QR Code</h1>
        <p className="text-[#6B7280]">Un unico codice per pagamenti e inviti</p>
      </div>

      {/* QR Code Display */}
      <div className="px-6 py-6 flex flex-col items-center">
        <div className="bg-white rounded-3xl p-6 mb-6 animate-slideUp shadow-lg shadow-[#2B7AB8]/20" data-testid="qr-container">
          <QRCode value={qrCode} size={240} />
        </div>

        <div className="text-center mb-6">
          <p className="font-mono text-xl text-[#2B7AB8] mb-2">{qrCode}</p>
          <p className="text-lg text-white">{user?.full_name}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="up-badge text-xs">
              {user?.up_points || 0} UP
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm space-y-3">
          <Button
            onClick={handleShare}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary"
            data-testid="share-btn"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Condividi QR Code
          </Button>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full h-12 rounded-full border-black/20 bg-transparent hover:bg-white/5"
            data-testid="copy-btn"
          >
            <Copy className="w-5 h-5 mr-2" />
            {copied ? "Copiato!" : "Copia Link"}
          </Button>
        </div>

        {/* Info Cards */}
        <div className="mt-8 w-full max-w-sm space-y-4">
          {/* Payment Info */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#2B7AB8]/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#2B7AB8]" />
              </div>
              <h3 className="font-semibold">Per Pagamenti</h3>
            </div>
            <p className="text-sm text-[#6B7280]">
              Chi ha già myUup.com può scansionare e pagarti direttamente con il tastierino numerico.
            </p>
          </div>

          {/* Referral Info */}
          <div className="bg-gradient-to-br from-[#E85A24]/10 to-[#E85A24]/5 rounded-2xl p-5 border border-[#E85A24]/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#E85A24]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#E85A24]" />
              </div>
              <h3 className="font-semibold text-[#1A1A1A]">Per Nuovi Utenti</h3>
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              Chi scansiona e non ha l'app verrà guidato all'<span className="text-[#E85A24] font-semibold">installazione automatica</span> e alla registrazione con il tuo referral.
            </p>
            <div className="bg-white rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">Bonus per entrambi</span>
              <span className="font-mono font-bold text-[#E85A24]">+1 UP</span>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="qr" />
    </div>
  );
}
