import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Check, User, Store, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// API
import { paymentAPI } from "@/lib/api";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { qrCode } = useParams();
  const { user } = useAuth();
  const [recipient, setRecipient] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecipient();
  }, [qrCode]);

  const fetchRecipient = async () => {
    try {
      const userData = await paymentAPI.getUserByQR(qrCode);
      setRecipient(userData);
    } catch (err) {
      console.error("Error fetching recipient:", err);
      setError("QR code non valido");
    }
    setLoading(false);
  };

  const handleKeyPress = (key) => {
    if (key === "backspace") {
      setAmount(prev => prev.slice(0, -1));
    } else if (key === ".") {
      if (!amount.includes(".") && amount.length > 0) {
        setAmount(prev => prev + ".");
      }
    } else {
      // Limit to 2 decimal places
      const parts = amount.split(".");
      if (parts.length === 2 && parts[1].length >= 2) return;
      if (amount.length >= 7) return;
      setAmount(prev => prev + key);
    }
  };

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    
    setSending(true);
    try {
      await paymentAPI.sendPayment(qrCode, numAmount, note || null);
      
      setSuccess(true);
      toast.success("Pagamento inviato!");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      toast.error(err.message || "Errore nel pagamento");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <button 
          onClick={() => navigate("/scan")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Indietro</span>
        </button>
        
        <div className="flex flex-col items-center justify-center mt-20">
          <div className="w-16 h-16 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-[#FF3B30]" />
          </div>
          <h2 className="font-heading text-xl font-bold mb-2">Errore</h2>
          <p className="text-[#6B7280] text-center mb-6">{error}</p>
          <Button
            onClick={() => navigate("/scan")}
            className="rounded-full bg-[#2B7AB8] hover:bg-[#236699]"
          >
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-[#E85A24] flex items-center justify-center mb-6 glow-secondary animate-slideUp">
          <Check className="w-10 h-10 text-[#050505]" />
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2">Pagamento Inviato!</h2>
        <p className="text-[#6B7280] text-center mb-2">
          {parseFloat(amount).toFixed(2)} UP a {recipient?.name}
        </p>
        <p className="text-[#6B7280] text-sm">Reindirizzamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => navigate("/scan")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Annulla</span>
        </button>
      </div>

      {/* Recipient Info */}
      <div className="px-6 mb-6">
        <div className="bg-[#F5F5F5] rounded-2xl p-4 flex items-center gap-4 border border-black/5">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${recipient?.type === 'merchant' ? 'bg-[#E85A24]/10' : 'bg-[#2B7AB8]/10'}`}>
            {recipient?.type === 'merchant' ? (
              <Store className="w-7 h-7 text-[#E85A24]" />
            ) : (
              <User className="w-7 h-7 text-[#2B7AB8]" />
            )}
          </div>
          <div>
            <p className="font-semibold text-lg">{recipient?.name}</p>
            <p className="text-sm text-[#6B7280]">
              {recipient?.type === 'merchant' ? 'Merchant' : 'Utente Myunionpaytest.it'}
            </p>
          </div>
        </div>
      </div>

      {/* Amount Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-[#6B7280] text-sm mb-2">Importo da inviare</p>
        <div className="flex items-baseline mb-8">
          <input
            type="text"
            value={amount || "0"}
            readOnly
            className="amount-input w-48"
            data-testid="amount-display"
          />
          <span className="font-mono text-2xl font-bold ml-2 text-[#6B7280]">UP</span>
        </div>

        {/* Note input */}
        <input
          type="text"
          placeholder="Aggiungi una nota (opzionale)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full max-w-xs bg-[#F5F5F5] border border-black/10 rounded-xl px-4 py-3 text-center text-[#6B7280] placeholder-[#A1A1AA]/50 focus:border-[#2B7AB8] focus:outline-none mb-8"
          data-testid="note-input"
        />
      </div>

      {/* Keypad */}
      <div className="px-6 pb-8">
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key === "⌫" ? "backspace" : String(key))}
              className="keypad-btn"
              data-testid={`keypad-${key === "⌫" ? "backspace" : key}`}
            >
              {key}
            </button>
          ))}
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !amount || parseFloat(amount) <= 0}
          className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="send-payment-btn"
        >
          {sending ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            `Invia ${amount || "0"} UP`
          )}
        </Button>
      </div>
    </div>
  );
}
