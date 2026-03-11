import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ToggleLeft, Phone, Landmark, Save, Eye, EyeOff, Key, Globe, Server, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { featuresAPI } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

const CATEGORY_LABELS = {
  generale: "Generale",
  fintech: "Fintech",
  telefonia: "Telefonia",
};

const CATEGORY_ORDER = ["generale", "fintech", "telefonia"];

export default function AdminFeaturesPage() {
  const navigate = useNavigate();
  const [toggles, setToggles] = useState({});
  const [apiConfigs, setApiConfigs] = useState({});
  const [pricing, setPricing] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingApi, setSavingApi] = useState(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [featData, apiData, pricingData] = await Promise.all([
        featuresAPI.adminGet(),
        featuresAPI.adminGetApiConfig(),
        featuresAPI.adminGetPricing(),
      ]);
      setToggles(featData.toggles || {});
      setApiConfigs(apiData.configs || {});
      setPricing(pricingData.pricing || {});
    } catch (err) {
      toast.error("Errore nel caricamento");
    }
    setLoading(false);
  };

  const handleToggle = async (key) => {
    const newValue = !toggles[key]?.enabled;
    setToggles(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: newValue }
    }));
    try {
      await featuresAPI.adminUpdate({ [key]: newValue });
      toast.success(`${toggles[key]?.label} ${newValue ? "abilitato" : "disabilitato"}`);
    } catch (err) {
      setToggles(prev => ({
        ...prev,
        [key]: { ...prev[key], enabled: !newValue }
      }));
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleApiConfigChange = (section, field, value) => {
    setApiConfigs(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const handlePricingChange = (key, value) => {
    setPricing(prev => ({
      ...prev,
      [key]: { ...prev[key], price: value }
    }));
  };

  const savePricing = async () => {
    setSavingPricing(true);
    try {
      const updates = {};
      Object.entries(pricing).forEach(([key, val]) => {
        updates[key] = parseFloat(val.price) || 0;
      });
      await featuresAPI.adminUpdatePricing(updates);
      toast.success("Prezzi aggiornati!");
    } catch (err) {
      toast.error("Errore nel salvataggio prezzi");
    }
    setSavingPricing(false);
  };

  const saveApiConfig = async (section) => {
    setSavingApi(section);
    try {
      const config = apiConfigs[section];
      await featuresAPI.adminUpdateApiConfig(section, {
        provider: config.provider,
        api_key: config.api_key,
        api_secret: config.api_secret,
        endpoint: config.endpoint,
        enabled: config.enabled,
        notes: config.notes,
      });
      toast.success(`Configurazione ${section} salvata`);
    } catch (err) {
      toast.error("Errore nel salvataggio");
    }
    setSavingApi(null);
  };

  const groupedToggles = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: Object.entries(toggles).filter(([, v]) => v.category === cat),
  })).filter(g => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe">
      <div className="px-6 pt-8 pb-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <ToggleLeft className="w-6 h-6 text-[#2B7AB8]" />
          <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">
            Gestione Funzionalità
          </h1>
        </div>

        {/* Feature Toggles */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide mb-4">
            Visibilità Funzioni
          </h2>
          <p className="text-sm text-[#6B7280] mb-6">
            Abilita o disabilita le funzioni visibili a tutti gli utenti.
          </p>

          {groupedToggles.map((group) => (
            <div key={group.category} className="mb-6">
              <h3 className="text-xs font-bold text-[#2B7AB8] uppercase tracking-wider mb-3">
                {group.label}
              </h3>
              <div className="bg-[#F5F5F5] rounded-2xl border border-black/5 divide-y divide-black/5">
                {group.items.map(([key, toggle]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-5 py-4"
                    data-testid={`toggle-${key}`}
                  >
                    <span className="font-medium text-[#1A1A1A]">{toggle.label}</span>
                    <button
                      onClick={() => handleToggle(key)}
                      className={`relative w-12 h-7 rounded-full transition-colors ${
                        toggle.enabled ? "bg-[#2B7AB8]" : "bg-gray-300"
                      }`}
                      data-testid={`switch-${key}`}
                    >
                      <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        toggle.enabled ? "translate-x-5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#E85A24]/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#E85A24]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#1A1A1A]">Prezzi Servizi (UP)</h2>
              <p className="text-xs text-[#6B7280]">Configura il costo di ogni servizio in UP</p>
            </div>
          </div>

          <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 space-y-4">
            {Object.entries(pricing).map(([key, item]) => (
              <div key={key} className="flex items-center justify-between gap-4" data-testid={`pricing-${key}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A1A1A]">{item.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price}
                    onChange={(e) => handlePricingChange(key, e.target.value)}
                    className="w-24 h-9 rounded-lg border border-black/10 bg-white px-3 text-sm text-right font-mono text-[#1A1A1A] focus:outline-none focus:border-[#2B7AB8]"
                    data-testid={`price-input-${key}`}
                  />
                  <span className="text-sm font-bold text-[#E85A24]">UP</span>
                </div>
              </div>
            ))}

            <Button
              onClick={savePricing}
              disabled={savingPricing}
              className="w-full h-11 rounded-xl bg-[#E85A24] hover:bg-[#D14E1A] text-white mt-2"
              data-testid="save-pricing-btn"
            >
              {savingPricing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salva Prezzi
                </>
              )}
            </Button>
          </div>
        </div>

        {/* API Telefonia */}
        <ApiConfigSection
          icon={Phone}
          title="API Telefonia"
          section="telefonia"
          config={apiConfigs.telefonia || {}}
          onChange={(field, value) => handleApiConfigChange("telefonia", field, value)}
          onSave={() => saveApiConfig("telefonia")}
          saving={savingApi === "telefonia"}
          showSecret={showSecrets.telefonia}
          toggleSecret={() => setShowSecrets(p => ({ ...p, telefonia: !p.telefonia }))}
        />

        {/* API Fintech */}
        <ApiConfigSection
          icon={Landmark}
          title="Funzioni Fintech"
          section="fintech"
          config={apiConfigs.fintech || {}}
          onChange={(field, value) => handleApiConfigChange("fintech", field, value)}
          onSave={() => saveApiConfig("fintech")}
          saving={savingApi === "fintech"}
          showSecret={showSecrets.fintech}
          toggleSecret={() => setShowSecrets(p => ({ ...p, fintech: !p.fintech }))}
        />
      </div>

      <BottomNav active="home" />
    </div>
  );
}

function ApiConfigSection({ icon: Icon, title, section, config, onChange, onSave, saving, showSecret, toggleSecret }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#2B7AB8]" />
        </div>
        <div>
          <h2 className="font-semibold text-[#1A1A1A]">{title}</h2>
          <p className="text-xs text-[#6B7280]">Configurazione API</p>
        </div>
      </div>

      <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 space-y-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#1A1A1A]">API Attiva</span>
          <button
            onClick={() => onChange("enabled", !config.enabled)}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              config.enabled ? "bg-green-500" : "bg-gray-300"
            }`}
            data-testid={`api-toggle-${section}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              config.enabled ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[#6B7280] flex items-center gap-1">
              <Server className="w-3 h-3" /> Provider
            </Label>
            <Input
              value={config.provider || ""}
              onChange={(e) => onChange("provider", e.target.value)}
              placeholder="Nome provider (es. Treezor, Twilio)"
              className="h-10 bg-white border-black/10 rounded-xl text-sm text-[#1A1A1A]"
              data-testid={`provider-${section}`}
            />
          </div>

          <div>
            <Label className="text-xs text-[#6B7280] flex items-center gap-1">
              <Key className="w-3 h-3" /> API Key
            </Label>
            <Input
              value={config.api_key || ""}
              onChange={(e) => onChange("api_key", e.target.value)}
              placeholder="Chiave API"
              className="h-10 bg-white border-black/10 rounded-xl text-sm text-[#1A1A1A]"
              data-testid={`api-key-${section}`}
            />
          </div>

          <div>
            <Label className="text-xs text-[#6B7280] flex items-center gap-1">
              <Key className="w-3 h-3" /> API Secret
            </Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={config.api_secret || ""}
                onChange={(e) => onChange("api_secret", e.target.value)}
                placeholder="Secret API"
                className="h-10 bg-white border-black/10 rounded-xl text-sm text-[#1A1A1A] pr-10"
                data-testid={`api-secret-${section}`}
              />
              <button
                type="button"
                onClick={toggleSecret}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#6B7280] flex items-center gap-1">
              <Globe className="w-3 h-3" /> Endpoint
            </Label>
            <Input
              value={config.endpoint || ""}
              onChange={(e) => onChange("endpoint", e.target.value)}
              placeholder="https://api.provider.com/v1"
              className="h-10 bg-white border-black/10 rounded-xl text-sm text-[#1A1A1A]"
              data-testid={`endpoint-${section}`}
            />
          </div>

          <div>
            <Label className="text-xs text-[#6B7280]">Note</Label>
            <textarea
              value={config.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              placeholder="Note aggiuntive..."
              rows={2}
              className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-[#1A1A1A] resize-none focus:outline-none focus:border-[#2B7AB8]"
              data-testid={`notes-${section}`}
            />
          </div>
        </div>

        <Button
          onClick={onSave}
          disabled={saving}
          className="w-full h-11 rounded-xl bg-[#2B7AB8] hover:bg-[#236699] text-white"
          data-testid={`save-api-${section}`}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salva Configurazione
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
