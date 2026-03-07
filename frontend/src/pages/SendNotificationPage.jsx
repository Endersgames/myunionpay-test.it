import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Send, Users, Wallet, AlertCircle, 
  MapPin, Globe, Eye, User, Tag, Image, X, Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// API
import { walletAPI, merchantAPI, notificationAPI, PROFILE_TAGS } from "@/lib/api";

export default function SendNotificationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    target_tags: [],
    reward_amount: 0.10,
    target_cap: "",
    target_all_italy: true,
    template_type: "generic",
    image_url: "",
    cta_text: "",
    cta_url: ""
  });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Immagine troppo grande. Max 5MB.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("token");
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
      const res = await fetch(`${backendUrl}/api/notifications/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const data = await res.json();
      setFormData(prev => ({ ...prev, image_url: data.image_url }));
      setImagePreview(URL.createObjectURL(file));
      toast.success("Immagine caricata!");
    } catch (err) {
      toast.error("Errore upload immagine");
    }
    setUploading(false);
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image_url: "" }));
    setImagePreview(null);
  };

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      target_tags: prev.target_tags.includes(tag)
        ? prev.target_tags.filter(t => t !== tag)
        : [...prev.target_tags, tag]
    }));
    setPreviewData(null); // Reset preview when tags change
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const result = await notificationAPI.preview({
        target_tags: formData.target_tags,
        target_cap: formData.target_cap,
        target_all_italy: formData.target_all_italy
      });
      setPreviewData(result);
      setShowPreview(true);
    } catch (err) {
      toast.error(err.message || "Errore nel caricamento preview");
    }
    setPreviewing(false);
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

    if (!previewData || previewData.total_users === 0) {
      toast.error("Nessun utente trovato. Modifica i filtri.");
      return;
    }

    const totalCost = previewData.total_users * formData.reward_amount;
    if (wallet && wallet.balance < totalCost) {
      toast.error(`Saldo insufficiente. Servono ${totalCost.toFixed(2)} UP`);
      return;
    }
    
    setSending(true);
    try {
      const result = await notificationAPI.sendMerchantNotification({
        template_type: formData.template_type,
        title: formData.title,
        message: formData.message,
        image_url: formData.image_url || null,
        cta_text: formData.cta_text || null,
        cta_url: formData.cta_url || null,
        reward_amount: formData.reward_amount,
        target_tags: formData.target_tags,
        target_cap: formData.target_cap,
        target_all_italy: formData.target_all_italy,
      });
      toast.success(`Notifica inviata a ${result.recipients} utenti!`);
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

  const totalCost = previewData ? previewData.total_users * formData.reward_amount : 0;

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
        {wallet && wallet.balance < 5 && (
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
          {/* Title & Message */}
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

          {/* Template Type */}
          <div className="space-y-2">
            <Label className="text-[#1A1A1A]">Tipo Notifica</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "promo_offer", label: "Promo", icon: "tag", color: "bg-[#E85A24]" },
                { id: "new_menu", label: "Menu", icon: "utensils", color: "bg-emerald-500" },
                { id: "event", label: "Evento", icon: "calendar", color: "bg-purple-500" },
                { id: "generic", label: "Generico", icon: "megaphone", color: "bg-[#2B7AB8]" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFormData(prev => ({ ...prev, template_type: t.id }))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                    formData.template_type === t.id 
                      ? `${t.color} text-white border-transparent` 
                      : "bg-white text-[#1A1A1A] border-black/10 hover:border-black/20"
                  }`}
                  data-testid={`template-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-5 h-5 text-[#2B7AB8]" />
              <Label className="text-[#1A1A1A] font-semibold">Immagine Promo</Label>
              <span className="text-xs text-[#6B7280]">(Opzionale)</span>
            </div>
            
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={imagePreview} alt="Promo" className="w-full h-40 object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                  data-testid="remove-image-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-black/15 rounded-xl cursor-pointer hover:border-[#2B7AB8]/40 transition bg-white">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                  data-testid="image-upload-input"
                />
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Image className="w-8 h-8 text-[#6B7280] mb-2" />
                    <span className="text-sm text-[#6B7280]">Carica immagine promo</span>
                    <span className="text-xs text-[#9CA3AF] mt-1">JPG, PNG, WebP - Max 5MB</span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* CTA Button */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#E85A24]" />
              <Label className="text-[#1A1A1A] font-semibold">Call-to-Action</Label>
              <span className="text-xs text-[#6B7280]">(Opzionale)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Testo bottone (es: Scopri)"
                value={formData.cta_text}
                onChange={(e) => setFormData(prev => ({ ...prev, cta_text: e.target.value }))}
                className="h-11 bg-[#F5F5F5] border-black/10 rounded-xl text-sm"
                data-testid="cta-text-input"
              />
              <Input
                placeholder="Link (es: /menu/...)"
                value={formData.cta_url}
                onChange={(e) => setFormData(prev => ({ ...prev, cta_url: e.target.value }))}
                className="h-11 bg-[#F5F5F5] border-black/10 rounded-xl text-sm"
                data-testid="cta-url-input"
              />
            </div>
          </div>

          {/* Target Tags - Profilazione Interessi */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-[#2B7AB8]" />
              <Label className="text-[#1A1A1A] font-semibold">Profilazione Interessi</Label>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">
              Seleziona gli interessi per targettizzare gli utenti (vuoto = tutti)
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

          {/* Location Filter */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-[#E85A24]" />
              <Label className="text-[#1A1A1A] font-semibold">Area Geografica</Label>
            </div>

            {/* All Italy Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[#1A1A1A]">Tutta Italia</span>
              </div>
              <Switch
                checked={formData.target_all_italy}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, target_all_italy: checked }));
                  setPreviewData(null);
                }}
                data-testid="all-italy-switch"
              />
            </div>

            {/* CAP Input (only if not all Italy) */}
            {!formData.target_all_italy && (
              <div className="space-y-2 animate-slideUp">
                <Label htmlFor="cap" className="text-[#6B7280]">CAP Specifico</Label>
                <Input
                  id="cap"
                  placeholder="Es: 00186"
                  value={formData.target_cap}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, target_cap: e.target.value }));
                    setPreviewData(null);
                  }}
                  className="h-12 bg-white border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
                  maxLength={5}
                  data-testid="cap-input"
                />
                <p className="text-xs text-[#6B7280]">
                  Inserisci il CAP per inviare solo agli utenti di quella zona
                </p>
              </div>
            )}
          </div>

          {/* Reward Amount Slider */}
          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#2B7AB8]" />
                <Label className="text-[#1A1A1A] font-semibold">Reward per Utente</Label>
              </div>
              <span className="font-mono text-xl font-bold text-[#E85A24]">
                {formData.reward_amount.toFixed(2)} UP
              </span>
            </div>
            <Slider
              value={[formData.reward_amount * 100]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, reward_amount: value / 100 }))}
              min={1}
              max={300}
              step={1}
              className="py-4"
              data-testid="reward-slider"
            />
            <div className="flex justify-between text-xs text-[#6B7280]">
              <span>0.01 UP</span>
              <span>3.00 UP</span>
            </div>
          </div>

          {/* Preview Button */}
          <Button
            onClick={handlePreview}
            disabled={previewing}
            variant="outline"
            className="w-full h-14 rounded-full border-[#2B7AB8] text-[#2B7AB8] hover:bg-[#2B7AB8]/10"
            data-testid="preview-btn"
          >
            {previewing ? (
              <div className="w-6 h-6 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Eye className="w-5 h-5 mr-2" />
                Anteprima Utenti Target
              </>
            )}
          </Button>

          {/* Preview Results */}
          {showPreview && previewData && (
            <div className="bg-[#2B7AB8]/5 rounded-2xl p-5 border border-[#2B7AB8]/20 animate-slideUp">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2B7AB8]" />
                  Utenti Trovati
                </h3>
                <span className="text-2xl font-mono font-bold text-[#2B7AB8]">
                  {previewData.total_users}
                </span>
              </div>

              {previewData.total_users === 0 ? (
                <p className="text-[#6B7280] text-center py-4">
                  Nessun utente corrisponde ai criteri selezionati
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                    {previewData.users.map((u, idx) => (
                      <div 
                        key={u.id || idx}
                        className="flex items-center justify-between bg-white rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2B7AB8]/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#2B7AB8]" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-[#1A1A1A]">{u.full_name}</p>
                            <p className="text-xs text-[#6B7280]">CAP: {u.cap}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {u.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-[#E85A24]/10 text-[#E85A24] rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewData.total_users > 20 && (
                    <p className="text-xs text-[#6B7280] text-center">
                      ... e altri {previewData.total_users - 20} utenti
                    </p>
                  )}
                </>
              )}

              {/* Cost Summary */}
              <div className="mt-4 pt-4 border-t border-[#2B7AB8]/20">
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280]">Costo Totale</span>
                  <span className="font-mono text-xl font-bold text-[#2B7AB8]">
                    {totalCost.toFixed(2)} UP
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-[#6B7280]">Il tuo saldo</span>
                  <span className={`font-mono ${wallet?.balance >= totalCost ? 'text-green-600' : 'text-[#FF3B30]'}`}>
                    {wallet?.balance.toFixed(2)} UP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={sending || !formData.title || !formData.message || !previewData || previewData.total_users === 0}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary disabled:opacity-50"
            data-testid="send-notification-submit-btn"
          >
            {sending ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Invia a {previewData?.total_users || 0} Utenti
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
