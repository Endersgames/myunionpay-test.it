import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Copy, Share2, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import QRCode from "@/components/QRCode";

export default function QRCodePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const qrCode = user?.qr_code || "";
  const referralCode = user?.referral_code || "";
  
  const paymentUrl = `${window.location.origin}/pay/${qrCode}`;
  const referralUrl = `${window.location.origin}/register?ref=${referralCode}`;

  const handleCopyPayment = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopiedPayment(true);
    toast.success("Link pagamento copiato!");
    setTimeout(() => setCopiedPayment(false), 2000);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    toast.success("Link referral copiato!");
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleSharePayment = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Pagami con UpPay",
          text: `Paga ${user?.full_name} con UpPay`,
          url: paymentUrl
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      handleCopyPayment();
    }
  };

  const handleShareReferral = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Unisciti a UpPay",
          text: `Registrati con il mio codice e guadagna 1 UP! Codice: ${referralCode}`,
          url: referralUrl
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      handleCopyReferral();
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

        <h1 className="font-heading text-2xl font-bold mb-2">I Tuoi QR Code</h1>
        <p className="text-[#A1A1AA]">Condividi per ricevere pagamenti o invitare amici</p>
      </div>

      {/* QR Code Tabs */}
      <div className="px-6 py-4">
        <Tabs defaultValue="payment" className="w-full">
          <TabsList className="w-full bg-[#121212] border border-white/10 rounded-xl p-1 mb-6">
            <TabsTrigger 
              value="payment" 
              className="flex-1 rounded-lg data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white"
              data-testid="tab-payment"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Pagamenti
            </TabsTrigger>
            <TabsTrigger 
              value="referral"
              className="flex-1 rounded-lg data-[state=active]:bg-[#CCFF00] data-[state=active]:text-black"
              data-testid="tab-referral"
            >
              <Users className="w-4 h-4 mr-2" />
              Referral
            </TabsTrigger>
          </TabsList>

          {/* Payment QR */}
          <TabsContent value="payment" className="mt-0">
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-3xl p-6 mb-6 animate-slideUp" data-testid="qr-payment-container">
                <QRCode value={qrCode} size={220} type="payment" />
              </div>

              <div className="text-center mb-6">
                <p className="font-mono text-lg text-[#7C3AED] mb-1">{qrCode}</p>
                <p className="text-[#A1A1AA]">{user?.full_name}</p>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <Button
                  onClick={handleSharePayment}
                  className="w-full h-14 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-lg font-semibold glow-primary"
                  data-testid="share-payment-btn"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Condividi per Ricevere
                </Button>
                <Button
                  onClick={handleCopyPayment}
                  variant="outline"
                  className="w-full h-12 rounded-full border-white/20 bg-transparent hover:bg-white/5"
                  data-testid="copy-payment-btn"
                >
                  <Copy className="w-5 h-5 mr-2" />
                  {copiedPayment ? "Copiato!" : "Copia Link Pagamento"}
                </Button>
              </div>

              <div className="mt-6 bg-[#121212] rounded-2xl p-5 w-full max-w-sm border border-white/5">
                <h3 className="font-semibold mb-2">Come funziona</h3>
                <ul className="text-sm text-[#A1A1AA] space-y-2">
                  <li>• Mostra il QR a chi deve pagarti</li>
                  <li>• Il pagatore scansiona con la fotocamera</li>
                  <li>• Si apre UpPay con il tastierino</li>
                  <li>• Inserisce l'importo e conferma</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Referral QR */}
          <TabsContent value="referral" className="mt-0">
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-3xl p-6 mb-6 animate-slideUp" data-testid="qr-referral-container">
                <QRCode value={referralCode} size={220} type="referral" />
              </div>

              <div className="text-center mb-6">
                <p className="font-mono text-lg text-[#CCFF00] mb-1">{referralCode}</p>
                <p className="text-[#A1A1AA]">Il tuo codice invito</p>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <Button
                  onClick={handleShareReferral}
                  className="w-full h-14 rounded-full bg-[#CCFF00] hover:bg-[#b8e600] text-black text-lg font-semibold glow-secondary"
                  data-testid="share-referral-btn"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Invita Amici
                </Button>
                <Button
                  onClick={handleCopyReferral}
                  variant="outline"
                  className="w-full h-12 rounded-full border-white/20 bg-transparent hover:bg-white/5"
                  data-testid="copy-referral-btn"
                >
                  <Copy className="w-5 h-5 mr-2" />
                  {copiedReferral ? "Copiato!" : "Copia Link Invito"}
                </Button>
              </div>

              <div className="mt-6 bg-[#121212] rounded-2xl p-5 w-full max-w-sm border border-[#CCFF00]/20">
                <h3 className="font-semibold mb-2 text-[#CCFF00]">Guadagna UP Points!</h3>
                <ul className="text-sm text-[#A1A1AA] space-y-2">
                  <li>• Condividi il QR con i tuoi amici</li>
                  <li>• Quando si registrano, entrambi guadagnate</li>
                  <li>• <span className="text-[#CCFF00] font-semibold">+1 UP</span> per te</li>
                  <li>• <span className="text-[#CCFF00] font-semibold">+1 UP</span> per il tuo amico</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav active="qr" />
    </div>
  );
}
