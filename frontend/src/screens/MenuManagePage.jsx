import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { menuAPI, merchantAPI } from "@/lib/api";
import {
  ChevronLeft, Plus, Save, Trash2, Image, Globe, ChevronDown, ChevronUp, Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const CATEGORIES = ["antipasti", "primi", "secondi", "dolci", "bevande"];
const CAT_LABELS = { antipasti: "Antipasti", primi: "Primi Piatti", secondi: "Secondi", dolci: "Dolci", bevande: "Bevande" };
const LANG_LABELS = { it: "Italiano", en: "English", fr: "Francais", de: "Deutsch", es: "Espanol" };

const emptyLang = () => ({ it: "", en: "", fr: "", de: "", es: "" });

export default function MenuManagePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editLang, setEditLang] = useState("it");
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    category: "antipasti",
    name: emptyLang(),
    description: emptyLang(),
    price: "",
    origin: "",
    calories: "",
    health_recommended: emptyLang(),
    health_not_recommended: emptyLang(),
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [menuItems, merch] = await Promise.all([
        menuAPI.getMyItems(),
        merchantAPI.getMyMerchant(),
      ]);
      setItems(menuItems);
      setMerchant(merch);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleCoverUpload = async (file) => {
    setCoverUploading(true);
    try {
      const result = await menuAPI.uploadCoverImage(file);
      setMerchant({ ...merchant, cover_image_url: result.cover_image_url });
      toast.success("Copertina aggiornata");
    } catch (err) {
      toast.error(err.message);
    }
    setCoverUploading(false);
  };

  const resetForm = () => {
    setForm({
      category: "antipasti", name: emptyLang(), description: emptyLang(),
      price: "", origin: "", calories: "",
      health_recommended: emptyLang(), health_not_recommended: emptyLang(),
    });
    setEditLang("it");
  };

  const handleSaveItem = async () => {
    if (!form.name.it) { toast.error("Nome italiano obbligatorio"); return; }
    if (!form.price || parseFloat(form.price) <= 0) { toast.error("Prezzo non valido"); return; }

    setSaving(true);
    try {
      const data = {
        category: form.category,
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        origin: form.origin || null,
        calories: form.calories ? parseInt(form.calories) : null,
        health: (form.health_recommended.it || form.health_not_recommended.it) ? {
          recommended_for: form.health_recommended,
          not_recommended_for: form.health_not_recommended,
        } : null,
      };
      await menuAPI.createItem(data);
      toast.success("Piatto aggiunto");
      setShowAdd(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (itemId) => {
    try {
      await menuAPI.deleteItem(itemId);
      toast.success("Piatto rimosso");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (itemId, file) => {
    try {
      await menuAPI.uploadItemImage(itemId, file);
      toast.success("Immagine aggiornata");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (item) => {
    try {
      await menuAPI.updateItem(item.id, { active: !item.active });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setLangField = (field, value) => {
    setForm({ ...form, [field]: { ...form[field], [editLang]: value } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#E85A24] border-t-transparent rounded-full" />
      </div>
    );
  }

  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#F5F5F5]" data-testid="menu-manage-page">
      {/* Cover Image */}
      <div className="relative">
        {merchant?.cover_image_url ? (
          <div className="h-40 overflow-hidden">
            <img src={merchant.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-r from-[#1A1A1A] to-[#333]" />
        )}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10">
          <button onClick={() => navigate("/merchant-dashboard")} className="p-2 rounded-full bg-black/30 text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 text-white text-xs cursor-pointer">
            <Camera className="w-3.5 h-3.5" />
            {coverUploading ? "Caricamento..." : "Copertina"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])} />
          </label>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3 text-white">
          <h1 className="text-lg font-bold drop-shadow">{merchant?.business_name}</h1>
          <p className="text-xs text-white/70">Gestione Menu</p>
        </div>
      </div>

      {/* Add button */}
      <div className="px-4 py-3">
        <Button className="w-full bg-[#E85A24] hover:bg-[#D14E1A]" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="add-dish-btn">
          <Plus className="w-4 h-4 mr-2" /> Aggiungi Piatto
        </Button>
      </div>

      {/* Menu items by category */}
      <div className="px-4 pb-8 space-y-4">
        {CATEGORIES.map((cat) => {
          const catItems = groupedItems[cat];
          if (!catItems || catItems.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">{CAT_LABELS[cat]}</h3>
              <div className="space-y-2">
                {catItems.map((item) => (
                  <div key={item.id} className={`bg-white rounded-xl border overflow-hidden flex ${!item.active ? 'opacity-50' : ''}`}>
                    {/* Image */}
                    <label className="w-16 h-16 shrink-0 bg-[#F5F5F5] flex items-center justify-center cursor-pointer group relative">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-5 h-5 text-[#CCC]" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(item.id, e.target.files[0])} />
                    </label>
                    {/* Info */}
                    <div className="flex-1 p-2 min-w-0 flex items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A1A] truncate">{item.name?.it || "?"}</p>
                        <p className="text-xs text-[#E85A24] font-bold">{item.price?.toFixed(2)} EUR</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggle(item)} className="p-1.5 rounded text-xs text-[#6B7280] hover:bg-[#F5F5F5]">
                          {item.active ? "ON" : "OFF"}
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded text-red-400 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#E85A24]" /> Aggiungi Piatto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 border rounded-md px-3 text-sm bg-white"
                data-testid="dish-category"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>

            {/* Language tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {Object.entries(LANG_LABELS).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setEditLang(code)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    editLang === code ? 'bg-[#2B7AB8] text-white' : 'bg-[#F5F5F5] text-[#6B7280]'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Nome {editLang === "it" && <span className="text-red-500">*</span>}</label>
              <Input
                placeholder={`Nome in ${LANG_LABELS[editLang]}`}
                value={form.name[editLang]}
                onChange={(e) => setLangField("name", e.target.value)}
                data-testid="dish-name"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Descrizione</label>
              <textarea
                placeholder={`Descrizione in ${LANG_LABELS[editLang]}`}
                value={form.description[editLang]}
                onChange={(e) => setLangField("description", e.target.value)}
                className="w-full h-16 text-sm border rounded-md p-2 resize-none"
                data-testid="dish-description"
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Prezzo EUR <span className="text-red-500">*</span></label>
                <Input type="number" step="0.01" placeholder="12.50" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="dish-price" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Calorie (opz.)</label>
                <Input type="number" placeholder="450" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} data-testid="dish-calories" />
              </div>
            </div>

            {/* Origin */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Provenienza (opz.)</label>
              <Input placeholder="Es. Campania, Toscana..." value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} data-testid="dish-origin" />
            </div>

            {/* Health section */}
            <div className="border rounded-lg p-3 space-y-2 bg-[#FAFAFA]">
              <p className="text-xs font-medium text-[#6B7280]">Sezione Salute (opzionale)</p>
              <div className="space-y-1">
                <label className="text-[10px] text-green-700">Indicato per ({editLang.toUpperCase()})</label>
                <Input
                  placeholder="Es. celiaci, sportivi..."
                  value={form.health_recommended[editLang]}
                  onChange={(e) => setForm({ ...form, health_recommended: { ...form.health_recommended, [editLang]: e.target.value } })}
                  className="h-8 text-xs"
                  data-testid="dish-health-rec"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-amber-700">Sconsigliato per ({editLang.toUpperCase()})</label>
                <Input
                  placeholder="Es. allergici a latticini..."
                  value={form.health_not_recommended[editLang]}
                  onChange={(e) => setForm({ ...form, health_not_recommended: { ...form.health_not_recommended, [editLang]: e.target.value } })}
                  className="h-8 text-xs"
                  data-testid="dish-health-notrec"
                />
              </div>
            </div>

            <Button className="w-full bg-[#E85A24] hover:bg-[#D14E1A]" onClick={handleSaveItem} disabled={saving} data-testid="save-dish-btn">
              {saving ? "Salvataggio..." : "Aggiungi Piatto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
