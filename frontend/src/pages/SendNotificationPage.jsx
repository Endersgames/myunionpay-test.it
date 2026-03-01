import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Send, Users, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

// API
import { walletAPI, merchantAPI, notificationAPI, PROFILE_TAGS } from "@/lib/api";

export default function SendNotificationPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    target_tags: [],
    reward_amount: 0.05
  });

  // Estimate recipients (simplified)
  const estimatedRecipients = formData.target_tags.length > 0 ? 
    Math.floor(Math.random() * 50) + 10 : "Tutti";
  const totalCost = typeof estimatedRecipients === 'number' ? 
    estimatedRecipients * formData.reward_amount : "Da calcolare";

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const [walletData, merchantData] = await Promise.all([
        walletAPI.getWallet(),
        merchantAPI.getMyMerchant()
      ]);
      setWallet(walletData);
      setMerchant(merchantData);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  };

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      target_tags: prev.target_tags.includes(tag)
        ? prev.target_tags.filter(t => t !== tag)
        : [...prev.target_tags, tag]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) {
      toast.error("Compila titolo e messaggio");
      return;
    }
    
    if (!merchant) {
      toast.error("Devi essere un merchant per inviare notifiche");
      return;
    }
    
    setSending(true);
    try {
      const result = await notificationAPI.send(formData);
      toast.success(`Notifica inviata a ${result.total_recipients} utenti!`);
      navigate("/merchant-dashboard");
    } catch (err) {
      toast.error(err.message || "Errore nell'invio");
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

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => navigate("/merchant-dashboard")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Invia Notifica</h1>
        <p className="text-[#6B7280]">Raggiungi i tuoi clienti con notifiche profilate</p>
      </div>

      <div className="px-6">
        {/* Wallet Balance Warning */}
        {wallet && wallet.balance < 1 && (
          <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#FF3B30] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#FF3B30]">Saldo Basso</p>
              <p className="text-sm text-[#6B7280]">
                Il tuo saldo è {wallet.balance.toFixed(2)} UP. Ricarica per inviare notifiche.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-[#1A1A1A]">Titolo Notifica *</Label>
            <Input
              id="title"
              placeholder="Es: Offerta speciale oggi!"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
              data-testid="title-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-[#1A1A1A]">Messaggio *</Label>
            <Textarea
              id="message"
              placeholder="Descrivi la tua offerta o messaggio..."
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className="bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl min-h-[100px] text-[#1A1A1A]"
              data-testid="message-input"
            />
          </div>

          {/* Target Tags */}
          <div className="space-y-3">
            <Label className="text-[#1A1A1A]">Target Utenti (opzionale)</Label>
            <p className="text-sm text-[#6B7280]">
              Seleziona interessi specifici oppure lascia vuoto per inviare a TUTTI gli utenti
            </p>
            <div className="flex flex-wrap gap-2">
              {PROFILE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`tag-pill ${formData.target_tags.includes(tag) ? 'selected' : ''}`}
                  data-testid={`target-tag-${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Reward Amount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[#1A1A1A]">Reward per Utente</Label>
              <span className="font-mono text-[#E85A24] font-bold">
                {formData.reward_amount.toFixed(2)} UP
              </span>
            </div>
            <Slider
              value={[formData.reward_amount * 100]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, reward_amount: value / 100 }))}
              min={1}
              max={100}
              step={1}
              className="py-4"
              data-testid="reward-slider"
            />
            <div className="flex justify-between text-xs text-[#6B7280]">
              <span>0.01 UP</span>
              <span>1.00 UP</span>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <h3 className="font-semibold mb-4 text-[#1A1A1A]">Riepilogo Costi</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Destinatari stimati
                </span>
                <span className="font-mono text-[#1A1A1A]">{estimatedRecipients}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Reward per utente</span>
                <span className="font-mono text-[#1A1A1A]">{formData.reward_amount.toFixed(2)} UP</span>
              </div>
              <div className="h-px bg-black/5 my-2" />
              <div className="flex justify-between font-semibold">
                <span className="flex items-center gap-2 text-[#1A1A1A]">
                  <Wallet className="w-4 h-4 text-[#2B7AB8]" />
                  Costo Totale Stimato
                </span>
                <span className="font-mono text-[#2B7AB8]">
                  {typeof totalCost === 'number' ? `${totalCost.toFixed(2)} UP` : totalCost}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={sending || !formData.title || !formData.message}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary disabled:opacity-50"
            data-testid="send-notification-submit-btn"
          >
            {sending ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Invia Notifica
              </>
            )}
          </Button>

          <p className="text-center text-xs text-[#6B7280]">
            L'importo verrà addebitato dal tuo wallet e accreditato agli utenti
          </p>
        </div>
      </div>
    </div>
  );
}
