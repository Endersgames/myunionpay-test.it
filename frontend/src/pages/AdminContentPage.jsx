import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { contentAPI } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

const CONTENT_KEYS = [
  { key: "data_treatment_1", label: "Trattamento Dati - Sezione 1" },
  { key: "data_treatment_2", label: "Trattamento Dati - Sezione 2" },
  { key: "data_treatment_3", label: "Trattamento Dati - Sezione 3" },
  { key: "data_treatment_4", label: "Trattamento Dati - Sezione 4" },
  { key: "privacy_policy", label: "Privacy Policy" },
];

export default function AdminContentPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentAPI.adminGetAll();
      setItems(data.items || []);
    } catch (err) {
      toast.error("Errore nel caricamento contenuti");
    }
    setLoading(false);
  };

  const startEdit = (item) => {
    setEditing(item.key);
    setEditForm({ title: item.title || "", content: item.content || "" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await contentAPI.adminUpdate(editing, editForm);
      toast.success("Contenuto aggiornato");
      setEditing(null);
      await fetchContent();
    } catch (err) {
      toast.error(err.message || "Errore nel salvataggio");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getItem = (key) => items.find(i => i.key === key) || { key, title: "", content: "" };

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
          <FileText className="w-6 h-6 text-[#2B7AB8]" />
          <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">Gestione Contenuti</h1>
        </div>

        <div className="space-y-4">
          {CONTENT_KEYS.map(({ key, label }) => {
            const item = getItem(key);
            const isEditing = editing === key;

            return (
              <div
                key={key}
                className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5"
                data-testid={`content-${key}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#2B7AB8] uppercase tracking-wide">{label}</span>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(item)}
                      className="text-sm text-[#2B7AB8] hover:underline font-medium"
                      data-testid={`edit-${key}`}
                    >
                      Modifica
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[#1A1A1A] text-sm">Titolo</Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="h-10 bg-white border-black/10 rounded-xl text-[#1A1A1A]"
                        data-testid={`title-input-${key}`}
                      />
                    </div>
                    <div>
                      <Label className="text-[#1A1A1A] text-sm">Contenuto</Label>
                      <textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                        rows={6}
                        className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-[#1A1A1A] resize-y focus:outline-none focus:border-[#2B7AB8]"
                        data-testid={`content-input-${key}`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setEditing(null)}
                        variant="outline"
                        className="flex-1 h-10 rounded-xl"
                      >
                        Annulla
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 h-10 rounded-xl bg-[#2B7AB8] hover:bg-[#236699] text-white"
                        data-testid={`save-${key}`}
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-1" />
                            Salva
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-[#1A1A1A] mb-1">{item.title || "Senza titolo"}</h3>
                    <p className="text-sm text-[#6B7280] line-clamp-3">
                      {item.content || "Nessun contenuto"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav active="home" />
    </div>
  );
}
