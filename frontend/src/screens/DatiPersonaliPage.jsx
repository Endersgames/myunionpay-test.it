import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { profileAPI } from "@/lib/api";

export default function DatiPersonaliPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
      });
    }
  }, [user]);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefono sono obbligatori");
      return;
    }
    setSaving(true);
    try {
      await profileAPI.updatePersonalData({
        full_name: form.full_name,
        phone: form.phone,
        address: form.address,
      });
      await refreshUser();
      toast.success("Dati aggiornati con successo");
    } catch (err) {
      toast.error(err.message || "Errore nell'aggiornamento");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Impostazioni</span>
      </button>

      <h1 className="font-heading text-2xl font-bold mb-6 text-[#1A1A1A]">Dati Personali</h1>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[#1A1A1A]">Nome Completo</Label>
          <Input
            value={form.full_name}
            onChange={handleChange("full_name")}
            className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
            data-testid="personal-name-input"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#1A1A1A]">Email</Label>
          <Input
            value={form.email}
            disabled
            className="h-12 bg-[#F5F5F5] border-black/10 rounded-xl text-[#6B7280]"
            data-testid="personal-email-input"
          />
          <p className="text-xs text-[#6B7280]">L'email non può essere modificata</p>
        </div>

        <div className="space-y-2">
          <Label className="text-[#1A1A1A]">Telefono</Label>
          <Input
            value={form.phone}
            onChange={handleChange("phone")}
            className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
            data-testid="personal-phone-input"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#1A1A1A]">Indirizzo</Label>
          <Input
            value={form.address}
            onChange={handleChange("address")}
            placeholder="Via Roma 1, 00100 Roma"
            className="h-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
            data-testid="personal-address-input"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold text-white mt-4"
          data-testid="personal-save-btn"
        >
          {saving ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              Salva Modifiche
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
