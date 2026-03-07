import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Store, QrCode, Bell, 
  Wallet, MapPin, ChevronRight, UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import QRCode from "@/components/QRCode";

// API
import { walletAPI, merchantAPI, MERCHANT_CATEGORIES } from "@/lib/api";

export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [merchant, setMerchant] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const [formData, setFormData] = useState({
    business_name: "",
    description: "",
    category: "",
    address: "",
    image_url: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const walletData = await walletAPI.getWallet();
      setWallet(walletData);

      if (user?.is_merchant) {
        const merchantData = await merchantAPI.getMyMerchant();
        setMerchant(merchantData);
      } else {
        setShowForm(true);
      }
    } catch (err) {
      console.error("Merchant dashboard error:", err);
      if (!user?.is_merchant) {
        setShowForm(true);
      }
    }
    setLoading(false);
  };

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleCategoryChange = (value) => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.business_name || !formData.description || !formData.category || !formData.address) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    
    setSubmitting(true);
    try {
      const merchantData = await merchantAPI.create(formData);
      setMerchant(merchantData);
      setShowForm(false);
      await refreshUser();
      toast.success("Negozio registrato con successo!");
    } catch (err) {
      toast.error(err.message || "Errore nella registrazione");
    }
    setSubmitting(false);
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
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Profilo</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">
          {showForm && !merchant ? "Registra Negozio" : "Dashboard Merchant"}
        </h1>
        <p className="text-[#6B7280]">
          {showForm && !merchant 
            ? "Compila i dati della tua attività" 
            : "Gestisci il tuo negozio e le notifiche"}
        </p>
      </div>

      {showForm && !merchant ? (
        /* Registration Form */
        <div className="px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="business_name" className="text-[#1A1A1A]">Nome Attività *</Label>
              <Input
                id="business_name"
                placeholder="Es: Caffè Roma"
                value={formData.business_name}
                onChange={handleChange("business_name")}
                className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
                data-testid="business-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-[#1A1A1A]">Categoria *</Label>
              <Select value={formData.category} onValueChange={handleCategoryChange}>
                <SelectTrigger 
                  className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl"
                  data-testid="category-select"
                >
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {MERCHANT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#1A1A1A]">Descrizione *</Label>
              <Textarea
                id="description"
                placeholder="Descrivi la tua attività..."
                value={formData.description}
                onChange={handleChange("description")}
                className="bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl min-h-[100px] text-[#1A1A1A]"
                data-testid="description-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-[#1A1A1A]">Indirizzo *</Label>
              <Input
                id="address"
                placeholder="Via Roma 1, Milano"
                value={formData.address}
                onChange={handleChange("address")}
                className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
                data-testid="address-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url" className="text-[#1A1A1A]">URL Immagine (opzionale)</Label>
              <Input
                id="image_url"
                placeholder="https://..."
                value={formData.image_url}
                onChange={handleChange("image_url")}
                className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
                data-testid="image-url-input"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary mt-4"
              data-testid="register-merchant-btn"
            >
              {submitting ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Registra Negozio"
              )}
            </Button>
          </form>
        </div>
      ) : merchant && (
        /* Merchant Dashboard */
        <div className="px-6">
          {/* Merchant Info Card */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-[#E85A24]/10 flex items-center justify-center">
                <Store className="w-7 h-7 text-[#E85A24]" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-lg text-[#1A1A1A]">{merchant.business_name}</h2>
                <p className="text-sm text-[#6B7280]">{merchant.category}</p>
                <p className="text-sm text-[#6B7280] flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {merchant.address}
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6B7280]">Saldo Wallet</p>
                  <p className="font-mono text-2xl font-bold text-[#1A1A1A]">{wallet?.balance?.toFixed(2) || "0.00"} UP</p>
                </div>
                <Wallet className="w-8 h-8 text-[#2B7AB8]" />
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
            <button 
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-5 h-5 text-[#2B7AB8]" />
                <div className="text-left">
                  <h3 className="font-semibold text-[#1A1A1A]">QR Code Cassa</h3>
                  <p className="text-sm text-[#6B7280]">Mostra ai clienti per ricevere pagamenti</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-[#6B7280] transition-transform ${showQR ? 'rotate-90' : ''}`} />
            </button>
            
            {showQR && (
              <div className="mt-4 pt-4 border-t border-black/5 flex flex-col items-center">
                <div className="bg-white rounded-2xl p-4 mb-3">
                  <QRCode value={merchant.qr_code} size={160} />
                </div>
                <p className="font-mono text-sm text-[#2B7AB8]">{merchant.qr_code}</p>
              </div>
            )}
          </div>

          {/* Send Notification Button */}
          <div className="space-y-3">
            {/* Menu Management - only for restaurants/bars */}
            {(merchant.category || "").toLowerCase().match(/ristorante|bar|caffetteria|pizzerie|alimentari/) && (
              <Button
                onClick={() => navigate("/menu-manage")}
                className="w-full h-14 rounded-full bg-[#E85A24] hover:bg-[#D14E1A] text-lg font-semibold"
                data-testid="manage-menu-btn"
              >
                <UtensilsCrossed className="w-5 h-5 mr-2" />
                Gestisci Menu
              </Button>
            )}

            <Button
              onClick={() => navigate("/send-notification")}
              className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary"
              data-testid="send-notification-btn"
            >
              <Bell className="w-5 h-5 mr-2" />
              Invia Notifica Profilata
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-4">
            Invia notifiche agli utenti e paga da 0.01 a 1.00 UP per destinatario
          </p>
        </div>
      )}
    </div>
  );
}
