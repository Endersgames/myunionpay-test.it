import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Copy, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import QRCode from "@/components/QRCode";

export default function QRCodePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const qrValue = user?.qr_code || "";
  const shareUrl = `${window.location.origin}/pay/${qrValue}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiato!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Pagami con UpPay",
          text: `Paga ${user?.full_name} con UpPay`,
          url: shareUrl
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2">Il Tuo QR Code</h1>
        <p className="text-[#A1A1AA]">Fai scansionare per ricevere pagamenti</p>
      </div>

      {/* QR Code Display */}
      <div className="px-6 py-8 flex flex-col items-center">
        <div className="bg-white rounded-3xl p-6 mb-6 animate-slideUp" data-testid="qr-container">
          <QRCode value={qrValue} size={220} />
        </div>

        <div className="text-center mb-8">
          <p className="font-mono text-lg text-[#7C3AED] mb-2">{qrValue}</p>
          <p className="text-[#A1A1AA]">{user?.full_name}</p>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm space-y-3">
          <Button
            onClick={handleShare}
            className="w-full h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-lg font-semibold glow-primary"
            data-testid="share-btn"
          >
            <Share2 className="w-5 h-5 mr-2" />
            Condividi
          </Button>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full h-14 rounded-full border-white/20 bg-transparent hover:bg-white/5"
            data-testid="copy-btn"
          >
            <Copy className="w-5 h-5 mr-2" />
            {copied ? "Copiato!" : "Copia Link"}
          </Button>
        </div>

        {/* Info */}
        <div className="mt-8 bg-[#121212] rounded-2xl p-5 w-full max-w-sm border border-white/5">
          <h3 className="font-semibold mb-2">Come funziona</h3>
          <ul className="text-sm text-[#A1A1AA] space-y-2">
            <li>• Mostra il QR a chi deve pagarti</li>
            <li>• Il pagatore scansiona con UpPay</li>
            <li>• Inserisce l'importo e conferma</li>
            <li>• Ricevi i soldi istantaneamente!</li>
          </ul>
        </div>
      </div>

      <BottomNav active="qr" />
    </div>
  );
}
