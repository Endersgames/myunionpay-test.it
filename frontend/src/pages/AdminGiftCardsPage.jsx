import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { giftcardAPI } from "@/lib/api";
import { useAuth } from "@/App";
import { Settings, Gift, ChevronLeft, Save, ToggleLeft, ToggleRight, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminGiftCardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

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
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#E85A24]" />
            <h1 className="text-lg font-bold">Admin - Gift Card</h1>
          </div>
        </div>
        <p className="text-sm text-white/60">Gestisci cashback e stato delle gift card</p>
      </div>

      {/* Cards List */}
      <div className="px-4 py-5 space-y-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`bg-white rounded-xl border p-4 ${card.active ? "border-black/5" : "border-red-200 opacity-60"}`}
            data-testid={`admin-card-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: card.logo_color + "18" }}
              >
                <Gift className="w-5 h-5" style={{ color: card.logo_color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{card.brand}</h3>
                  <button
                    onClick={() => handleToggle(card.id, card.active)}
                    className="text-sm"
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

            <div className="mt-3 flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#6B7280]" />
              {editingId === card.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 text-sm w-24"
                    data-testid={`cashback-input-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
                  />
                  <span className="text-xs text-[#6B7280]">%</span>
                  <Button
                    size="sm"
                    className="h-8 bg-[#E85A24] hover:bg-[#D14E1A]"
                    onClick={() => handleSaveCashback(card.id)}
                  >
                    <Save className="w-3 h-3 mr-1" /> Salva
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setEditingId(null)}
                  >
                    Annulla
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-bold text-[#E85A24]">{card.cashback_percent}%</span>
                  <span className="text-xs text-[#6B7280]">cashback</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 ml-auto text-xs"
                    onClick={() => { setEditingId(card.id); setEditValue(String(card.cashback_percent)); }}
                    data-testid={`edit-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
                  >
                    Modifica
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
