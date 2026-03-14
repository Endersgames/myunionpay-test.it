import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, Key, Save, Play, ToggleLeft, ToggleRight, Settings, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withBackendPath } from "@/lib/runtime-config";
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("auth_token")}`, "Content-Type": "application/json" });

const readErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.detail || data.error || fallback;
  } catch {
    return fallback;
  }
};

const MODELS = [
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano (economico)", cost: "Basso" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", cost: "Medio" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", cost: "Medio" },
  { id: "gpt-4o", label: "GPT-4o", cost: "Alto" },
  { id: "gemini-2.0-flash-lite", label: "Gemini Flash Lite (economico)", cost: "Basso" },
];

export default function AdminOpenAIPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ api_key: "", model: "gpt-4.1-nano", enabled: true, max_tokens: 150, temperature: 0.7 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(withBackendPath("/api/admin/openai/config"), { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setConfig(d);
        setForm(prev => ({ ...prev, model: d.model || "gpt-4.1-nano", enabled: d.enabled !== false, max_tokens: d.max_tokens || 150, temperature: d.temperature || 0.7 }));
      }
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.api_key && !config?.api_key_set) {
      toast.error("Inserisci una API key");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.api_key) body.api_key = "KEEP_EXISTING";
      const res = await fetch(withBackendPath("/api/admin/openai/config"), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      if (res.ok) {
        toast.success("Configurazione salvata!");
        fetchConfig();
        setForm(prev => ({ ...prev, api_key: "" }));
      } else {
        toast.error(await readErrorMessage(res, "Errore nel salvataggio"));
      }
    } catch { toast.error("Errore nel salvataggio"); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(withBackendPath("/api/admin/openai/test"), { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setTestResult(res.ok ? data : { success: false, error: data.detail || data.error || "Errore di connessione" });
    } catch { setTestResult({ success: false, error: "Errore di connessione" }); }
    setTesting(false);
  };

  if (!user?.is_admin) return <div className="min-h-screen flex items-center justify-center"><p>Accesso negato</p></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-8" data-testid="admin-openai-page">
      <div className="bg-white border-b border-black/5 px-5 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2" data-testid="back-btn"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="font-bold text-xl text-[#1A1A1A]">Configurazione AI</h1>
            <p className="text-xs text-[#6B7280]">Gestisci la connessione OpenAI per MYU</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Status */}
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config?.api_key_set ? "bg-emerald-500" : "bg-red-500"}`}>
                <Key className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">API Key</p>
                <p className="text-xs text-[#6B7280]">
                  {config?.api_key_set ? `Configurata (${config.api_key_preview})` : "Non configurata"}
                  {config?.source ? ` · sorgente ${config.source}` : ""}
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${config?.api_key_set ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
              {config?.api_key_set ? "ATTIVA" : "MANCANTE"}
            </span>
          </div>
        </div>

        {/* Config Form */}
        <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-[#2B7AB8]" />
            <p className="font-semibold text-sm">Impostazioni</p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">API Key {config?.api_key_set && "(lascia vuoto per mantenere)"}</label>
            <Input type="password" value={form.api_key} onChange={(e) => setForm(p => ({ ...p, api_key: e.target.value }))}
              placeholder={config?.api_key_set ? "****" : "Inserisci API key..."} className="h-10 rounded-xl bg-[#F5F5F5]" data-testid="api-key-input" />
            <p className="text-[11px] text-[#6B7280] mt-2">La chiave viene salvata e usata solo lato server. Al client torna solo una preview mascherata.</p>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs text-[#6B7280] mb-2 block">Modello AI</label>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button key={m.id} onClick={() => setForm(p => ({ ...p, model: m.id }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${form.model === m.id ? "border-[#2B7AB8] bg-[#2B7AB8]/5" : "border-black/5 hover:border-black/15"}`}
                  data-testid={`model-${m.id}`}>
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cost === "Basso" ? "bg-emerald-100 text-emerald-600" : m.cost === "Medio" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                    {m.cost}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AI Attiva</p>
              <p className="text-xs text-[#6B7280]">Abilita/disabilita MYU</p>
            </div>
            <button onClick={() => setForm(p => ({ ...p, enabled: !p.enabled }))} data-testid="toggle-ai">
              {form.enabled ? <ToggleRight className="w-10 h-6 text-emerald-500" /> : <ToggleLeft className="w-10 h-6 text-[#6B7280]" />}
            </button>
          </div>

          {/* Max tokens & Temperature */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Max Token Output</label>
              <Input type="number" value={form.max_tokens} onChange={(e) => setForm(p => ({ ...p, max_tokens: parseInt(e.target.value) || 150 }))}
                className="h-10 rounded-xl bg-[#F5F5F5]" data-testid="max-tokens" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Temperatura</label>
              <Input type="number" step="0.1" min="0" max="2" value={form.temperature}
                onChange={(e) => setForm(p => ({ ...p, temperature: parseFloat(e.target.value) || 0.7 }))}
                className="h-10 rounded-xl bg-[#F5F5F5]" data-testid="temperature" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl bg-[#2B7AB8] hover:bg-[#236699] font-semibold" data-testid="save-config">
            <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva Configurazione"}
          </Button>
        </div>

        {/* Test Connection */}
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play className="w-5 h-5 text-[#E85A24]" />
            <p className="font-semibold text-sm">Test Connessione</p>
          </div>

          <Button onClick={handleTest} disabled={testing} variant="outline" className="w-full h-10 rounded-xl border-[#E85A24]/30 text-[#E85A24] hover:bg-[#E85A24]/5" data-testid="test-connection">
            {testing ? "Testing..." : "Testa Connessione API"}
          </Button>

          {testResult && (
            <div className={`mt-3 p-3 rounded-xl ${testResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                <p className="text-sm font-medium">{testResult.success ? "Connessione riuscita!" : "Connessione fallita"}</p>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">{testResult.success ? `Modello: ${testResult.model}` : testResult.error}</p>
              {testResult.response && <p className="text-xs text-[#6B7280] mt-1">Risposta: "{testResult.response}"</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
