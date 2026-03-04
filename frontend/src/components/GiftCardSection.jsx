import { useState, useEffect } from "react";
import { giftcardAPI } from "@/lib/api";
import { useAuth } from "@/App";
import { Gift, ShoppingBag, Fuel, Tv, ShoppingCart, Home, Music, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const categoryIcons = {
  "Shopping online": ShoppingBag,
  "Auto e moto": Fuel,
  "Alimentari e bevande": ShoppingCart,
  "Elettronica": Tv,
  "Abbigliamento": Shirt,
  "Casa e arredo": Home,
  "Intrattenimento": Music,
};

export default function GiftCardSection({ onPurchase }) {
  const { refreshUser } = useAuth();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    giftcardAPI.getAll().then(setCards).catch(() => {});
  }, []);

  const handlePurchase = async (amount) => {
    setPurchasing(true);
    try {
      const result = await giftcardAPI.purchase(selectedCard.id, amount);
      toast.success(`Gift Card ${selectedCard.brand} da ${amount}UP acquistata! Cashback: +${result.cashback_earned.toFixed(2)} UP`);
      setSelectedCard(null);
      await refreshUser();
      if (onPurchase) onPurchase();
    } catch (err) {
      toast.error(err.message);
    }
    setPurchasing(false);
  };

  if (cards.length === 0) return null;

  return (
    <div className="mt-6" data-testid="giftcard-section">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Gift className="w-5 h-5 text-[#E85A24]" />
        <h3 className="font-bold text-[#1A1A1A] text-base">Gift Card</h3>
        <span className="text-xs text-[#6B7280] ml-auto">cashback in UP</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = categoryIcons[card.category] || Gift;
          return (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="relative bg-white rounded-xl border border-black/5 p-3 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
              data-testid={`giftcard-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.logo_color + "18" }}
              >
                <Icon className="w-5 h-5" style={{ color: card.logo_color }} />
              </div>
              <span className="text-xs font-semibold text-[#1A1A1A] text-center leading-tight truncate w-full">
                {card.brand}
              </span>
              <span className="text-[10px] font-bold text-[#E85A24] bg-[#E85A24]/10 px-1.5 py-0.5 rounded-full">
                {card.cashback_percent}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#E85A24]" />
              {selectedCard?.brand}
            </DialogTitle>
          </DialogHeader>

          {selectedCard && (
            <div className="space-y-4">
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: selectedCard.logo_color + "18" }}
                >
                  {(() => {
                    const Icon = categoryIcons[selectedCard.category] || Gift;
                    return <Icon className="w-8 h-8" style={{ color: selectedCard.logo_color }} />;
                  })()}
                </div>
                <p className="text-sm text-[#6B7280]">{selectedCard.category}</p>
                <p className="text-lg font-bold text-[#E85A24] mt-1">
                  Cashback {selectedCard.cashback_percent}%
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-[#6B7280] text-center">Seleziona importo</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCard.available_amounts.map((amount) => {
                    const cashback = (amount * selectedCard.cashback_percent / 100).toFixed(2);
                    return (
                      <Button
                        key={amount}
                        variant="outline"
                        className="h-auto py-3 flex flex-col gap-1 hover:border-[#E85A24] hover:bg-[#E85A24]/5"
                        onClick={() => handlePurchase(amount)}
                        disabled={purchasing}
                        data-testid={`purchase-${amount}`}
                      >
                        <span className="text-lg font-bold">{amount} UP</span>
                        <span className="text-[10px] text-[#E85A24] font-medium">
                          +{cashback} UP cashback
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
