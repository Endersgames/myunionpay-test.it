import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { giftcardAPI } from "@/lib/api";
import { useAuth } from "@/App";
import {
  Settings, Gift, ChevronLeft, Save, ToggleLeft, ToggleRight,
  Percent, Plus, Globe, Key, Play, Check, X, ChevronDown, ChevronUp,
  Upload, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = [
  "Shopping online", "Auto e moto", "Alimentari e bevande",
  "Elettronica", "Abbigliamento", "Casa e arredo", "Intrattenimento", "Altro"
];

export default function AdminGiftCardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [expandedApi, setExpandedApi] = useState(null);
  const [apiForm, setApiForm] = useState({});
  const [savingApi, setSavingApi] = useState(false);
  const [testingApi, setTestingApi] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    brand: "", category: "Shopping online", cashback_percent: 1.0,
    logo_color: "#333333", available_amounts: "25,50,100"
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user?.email !== "admin@test.com") {
      navigate("/dashboard");
      return;
    }
    fetchCards();
  }, [user, navigate]);

  const fetchCards = async () => {
    try {
      const data = await giftcardAPI.adminGetAll();
      setCards(data);
    } catch (err) {
      toast.error("Errore nel caricamento");
    }
    setLoading(false);
  };

  const handleSaveCashback = async (cardId) => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 0 || value > 50) {
      toast.error("Cashback deve essere tra 0% e 50%");
      return;
    }
    try {
      await giftcardAPI.adminUpdate(cardId, { cashback_percent: value });
      toast.success("Cashback aggiornato");
      setEditingId(null);
      fetchCards();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (cardId, currentActive) => {
    try {
      await giftcardAPI.adminUpdate(cardId, { active: !currentActive });
      toast.success(!currentActive ? "Gift card attivata" : "Gift card disattivata");
      fetchCards();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExpandApi = (card) => {
    if (expandedApi === card.id) {
      setExpandedApi(null);
      return;
    }
    setExpandedApi(card.id);
    setApiForm({
      api_endpoint: card.api_endpoint || "",
      api_key: card.api_key || "",
      api_method: card.api_method || "POST",
      api_headers: card.api_headers || "",
      api_body_template: card.api_body_template || "",
    });
    setTestResult(null);
  };

  const handleSaveApi = async (cardId) => {
    if (!apiForm.api_endpoint || !apiForm.api_key) {
      toast.error("Endpoint e API Key sono obbligatori");
      return;
    }
    setSavingApi(true);
    try {
      await giftcardAPI.adminUpdateApiConfig(cardId, apiForm);
      toast.success("Configurazione API salvata");
      fetchCards();
    } catch (err) {
      toast.error(err.message);
    }
    setSavingApi(false);
  };

  const handleTestApi = async (cardId) => {
    setTestingApi(cardId);
    setTestResult(null);
    try {
      const result = await giftcardAPI.adminTestApi(cardId);
      setTestResult(result);
      if (result.api_status === "success") {
        toast.success("API funzionante!");
      } else {
        toast.error(`API risposta: ${result.api_status}`);
      }
    } catch (err) {
      toast.error(err.message);
      setTestResult({ api_status: "error", raw_response: err.message });
    }
    setTestingApi(null);
  };

  const handleCreate = async () => {
    if (!createForm.brand) {
      toast.error("Nome brand obbligatorio");
      return;
    }
    setCreating(true);
    try {
      const amounts = createForm.available_amounts
        .split(",")
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
      await giftcardAPI.adminCreate({
        brand: createForm.brand,
        category: createForm.category,
        cashback_percent: parseFloat(createForm.cashback_percent) || 1.0,
        logo_color: createForm.logo_color,
        available_amounts: amounts.length ? amounts : [25, 50, 100],
      });
      toast.success(`Gift Card "${createForm.brand}" creata`);
      setShowCreate(false);
      setCreateForm({ brand: "", category: "Shopping online", cashback_percent: 1.0, logo_color: "#333333", available_amounts: "25,50,100" });
      fetchCards();
    } catch (err) {
      toast.error(err.message);
    }
    setCreating(false);
  };

  const handleUploadLogo = async (cardId, file) => {
    try {
      await giftcardAPI.adminUploadLogo(cardId, file);
      toast.success("Logo caricato");
      fetchCards();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#E85A24] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]" data-testid="admin-giftcards">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1A1A1A] to-[#333] text-white px-5 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Settings className="w-5 h-5 text-[#E85A24]" />
            <h1 className="text-lg font-bold">Admin - Gift Card</h1>
          </div>
          <Button
            size="sm"
            className="bg-[#E85A24] hover:bg-[#D14E1A] text-white"
            onClick={() => setShowCreate(true)}
            data-testid="add-giftcard-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> Aggiungi
          </Button>
        </div>
        <p className="text-sm text-white/60">Gestisci cashback, stato e API delle gift card</p>
      </div>

      {/* Cards List */}
      <div className="px-4 py-5 space-y-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`bg-white rounded-xl border overflow-hidden ${card.active ? "border-black/5" : "border-red-200 opacity-60"}`}
            data-testid={`admin-card-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
          >
            <div className="p-4">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <label className="cursor-pointer group relative">
                  {card.logo_url ? (
                    <img src={card.logo_url} alt={card.brand} className="w-10 h-10 rounded-lg object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.logo_color + "18" }}>
                      <Gift className="w-5 h-5" style={{ color: card.logo_color }} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUploadLogo(card.id, e.target.files[0])}
                  />
                </label>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{card.brand}</h3>
                    <button
                      onClick={() => handleToggle(card.id, card.active)}
                      data-testid={`toggle-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
                    >
                      {card.active ? (
                        <ToggleRight className="w-7 h-7 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[#6B7280]">{card.category}</p>
                </div>
              </div>

              {/* Cashback row */}
              <div className="mt-3 flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#6B7280]" />
                {editingId === card.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="number" step="0.01" value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 text-sm w-24"
                    />
                    <span className="text-xs text-[#6B7280]">%</span>
                    <Button size="sm" className="h-8 bg-[#E85A24] hover:bg-[#D14E1A]" onClick={() => handleSaveCashback(card.id)}>
                      <Save className="w-3 h-3 mr-1" /> Salva
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Annulla</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-bold text-[#E85A24]">{card.cashback_percent}%</span>
                    <span className="text-xs text-[#6B7280]">cashback</span>
                    <div className="ml-auto flex items-center gap-1">
                      {card.api_configured && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <Zap className="w-3 h-3" /> API
                        </span>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setEditingId(card.id); setEditValue(String(card.cashback_percent)); }}
                      >
                        Modifica
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* API Config toggle */}
              <button
                onClick={() => handleExpandApi(card)}
                className="mt-3 w-full flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#1A1A1A] transition-colors py-1"
                data-testid={`api-toggle-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Configurazione API Brand</span>
                {expandedApi === card.id ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
              </button>
            </div>

            {/* API Config Panel */}
            {expandedApi === card.id && (
              <div className="border-t bg-[#FAFAFA] p-4 space-y-3" data-testid={`api-config-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#1A1A1A] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#2B7AB8]" /> API Endpoint
                  </label>
                  <Input
                    placeholder="https://api.brand.com/v1/giftcard/activate"
                    value={apiForm.api_endpoint || ""}
                    onChange={(e) => setApiForm({ ...apiForm, api_endpoint: e.target.value })}
                    className="h-9 text-sm font-mono"
                    data-testid="api-endpoint-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#1A1A1A] flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#2B7AB8]" /> API Key / Codice Attivazione
                  </label>
                  <Input
                    placeholder="sk_live_xxxxx o codice partner"
                    value={apiForm.api_key || ""}
                    onChange={(e) => setApiForm({ ...apiForm, api_key: e.target.value })}
                    className="h-9 text-sm font-mono"
                    data-testid="api-key-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#1A1A1A]">Metodo</label>
                    <select
                      value={apiForm.api_method || "POST"}
                      onChange={(e) => setApiForm({ ...apiForm, api_method: e.target.value })}
                      className="w-full h-9 text-sm border rounded-md px-2 bg-white"
                      data-testid="api-method-select"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#1A1A1A]">Headers personalizzati (JSON)</label>
                  <textarea
                    placeholder={'{"X-Partner-Id": "xxx"}'}
                    value={apiForm.api_headers || ""}
                    onChange={(e) => setApiForm({ ...apiForm, api_headers: e.target.value })}
                    className="w-full h-16 text-xs font-mono border rounded-md p-2 resize-none bg-white"
                    data-testid="api-headers-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#1A1A1A]">
                    Body Template (JSON) - Variabili: {"{amount}"}, {"{email}"}, {"{user_name}"}, {"{brand}"}, {"{API_KEY}"}
                  </label>
                  <textarea
                    placeholder={'{"amount": {amount}, "currency": "EUR", "partner_key": "{API_KEY}"}'}
                    value={apiForm.api_body_template || ""}
                    onChange={(e) => setApiForm({ ...apiForm, api_body_template: e.target.value })}
                    className="w-full h-20 text-xs font-mono border rounded-md p-2 resize-none bg-white"
                    data-testid="api-body-input"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-[#2B7AB8] hover:bg-[#236799]"
                    onClick={() => handleSaveApi(card.id)}
                    disabled={savingApi}
                    data-testid="save-api-btn"
                  >
                    {savingApi ? "Salvataggio..." : <><Save className="w-4 h-4 mr-1" /> Salva API</>}
                  </Button>
                  {card.api_configured && (
                    <Button
                      variant="outline"
                      onClick={() => handleTestApi(card.id)}
                      disabled={testingApi === card.id}
                      data-testid="test-api-btn"
                    >
                      {testingApi === card.id ? (
                        <div className="w-4 h-4 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Play className="w-4 h-4 mr-1" /> Test</>
                      )}
                    </Button>
                  )}
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={`rounded-lg p-3 text-xs font-mono ${
                    testResult.api_status === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                  }`} data-testid="api-test-result">
                    <div className="flex items-center gap-1.5 mb-1">
                      {testResult.api_status === "success" ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-red-600" />
                      )}
                      <span className="font-semibold">Status: {testResult.api_status}</span>
                    </div>
                    {testResult.activation_code && (
                      <p className="text-green-700"><span className="font-semibold">Codice:</span> {testResult.activation_code}</p>
                    )}
                    {testResult.raw_response && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[#6B7280]">Risposta completa</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] max-h-32 overflow-auto">
                          {testResult.raw_response}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Gift Card Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#E85A24]" />
              Aggiungi Gift Card
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Nome Brand</label>
              <Input
                placeholder="Es. Netflix, Amazon..."
                value={createForm.brand}
                onChange={(e) => setCreateForm({ ...createForm, brand: e.target.value })}
                data-testid="create-brand-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Categoria</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                className="w-full h-10 border rounded-md px-3 text-sm bg-white"
                data-testid="create-category-select"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Cashback %</label>
                <Input
                  type="number" step="0.01"
                  value={createForm.cashback_percent}
                  onChange={(e) => setCreateForm({ ...createForm, cashback_percent: e.target.value })}
                  data-testid="create-cashback-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Colore Logo</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={createForm.logo_color}
                    onChange={(e) => setCreateForm({ ...createForm, logo_color: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <span className="text-xs font-mono text-[#6B7280]">{createForm.logo_color}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Importi disponibili (separati da virgola)</label>
              <Input
                placeholder="25,50,100"
                value={createForm.available_amounts}
                onChange={(e) => setCreateForm({ ...createForm, available_amounts: e.target.value })}
                data-testid="create-amounts-input"
              />
            </div>
            <Button
              className="w-full bg-[#E85A24] hover:bg-[#D14E1A]"
              onClick={handleCreate}
              disabled={creating || !createForm.brand}
              data-testid="confirm-create-btn"
            >
              {creating ? "Creazione..." : "Crea Gift Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
