import { useState, useEffect } from "react";
import { giftcardAPI, simAPI } from "@/lib/api";
import { useAuth } from "@/App";
import { Gift, ShoppingBag, Fuel, Tv, ShoppingCart, Home, Music, Shirt, CreditCard, Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [sim, setSim] = useState(null);
  const [linkedCard, setLinkedCard] = useState(null);
  const [showLinkCard, setShowLinkCard] = useState(false);
  const [linkForm, setLinkForm] = useState({ card_number: "", expiry: "", cvv: "", holder_name: "" });
  const [linking, setLinking] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);

  useEffect(() => {
    giftcardAPI.getAll().then(setCards).catch(() => {});
    simAPI.getMySim().then(setSim).catch(() => {});
    giftcardAPI.getLinkedCard().then(setLinkedCard).catch(() => {});
  }, []);

  const handlePurchase = async (paymentMethod) => {
    setPurchasing(true);
    try {
      const result = await giftcardAPI.purchase(selectedCard.id, selectedAmount, paymentMethod);
      setPurchaseResult(result);
      await refreshUser();
      if (onPurchase) onPurchase();
      simAPI.getMySim().then(setSim).catch(() => {});
    } catch (err) {
      toast.error(err.message);
    }
    setPurchasing(false);
  };

  const closePurchaseDialog = () => {
    setSelectedCard(null);
    setSelectedAmount(null);
    setPurchaseResult(null);
  };

  const handleLinkCard = async () => {
    setLinking(true);
    try {
      const result = await giftcardAPI.linkCard(linkForm);
      setLinkedCard(result);
      setShowLinkCard(false);
      setLinkForm({ card_number: "", expiry: "", cvv: "", holder_name: "" });
      toast.success(`Carta ****${result.last_four} collegata`);
    } catch (err) {
      toast.error(err.message);
    }
    setLinking(false);
  };

  if (cards.length === 0) return null;

  const hasContoUP = sim && sim.eur_balance !== undefined;
  const eurBalance = sim?.eur_balance || 0;
  const hasLinkedCard = !!linkedCard;

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
              onClick={() => { setSelectedCard(card); setSelectedAmount(null); }}
              className="relative bg-white rounded-xl border border-black/5 p-3 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
              data-testid={`giftcard-${card.brand.toLowerCase().replace(/[.\s]/g, '-')}`}
            >
              {card.logo_url ? (
                <img src={card.logo_url} alt={card.brand} className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.logo_color + "18" }}>
                  <Icon className="w-5 h-5" style={{ color: card.logo_color }} />
                </div>
              )}
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
      <Dialog open={!!selectedCard && !showLinkCard} onOpenChange={(open) => { if (!open) closePurchaseDialog(); }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#E85A24]" />
              {selectedCard?.brand}
            </DialogTitle>
          </DialogHeader>

          {/* Purchase Success - Show Activation Code */}
          {purchaseResult && (
            <div className="space-y-4" data-testid="purchase-result">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Gift className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-lg font-bold text-[#1A1A1A]">Acquisto completato!</p>
                <p className="text-sm text-[#6B7280] mt-1">
                  Gift Card {purchaseResult.brand} - {purchaseResult.amount} EUR
                </p>
                <p className="text-sm text-[#E85A24] font-medium mt-1">
                  +{purchaseResult.cashback_earned?.toFixed(2)} UP cashback
                </p>
              </div>

              {purchaseResult.activation_code && (
                <div className="bg-[#F5F5F5] rounded-xl p-4 text-center" data-testid="activation-code-display">
                  <p className="text-xs text-[#6B7280] mb-2">Codice Attivazione</p>
                  <p className="text-xl font-bold font-mono text-[#1A1A1A] tracking-wider select-all break-all">
                    {purchaseResult.activation_code}
                  </p>
                  <button
                    className="mt-2 text-xs text-[#2B7AB8] hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(purchaseResult.activation_code);
                      toast.success("Codice copiato!");
                    }}
                    data-testid="copy-code-btn"
                  >
                    Copia codice
                  </button>
                </div>
              )}

              {purchaseResult.api_status === "no_api" && (
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-700">API brand non configurata. Il codice sara disponibile quando l'admin configurera l'API.</p>
                </div>
              )}

              {purchaseResult.api_status && purchaseResult.api_status.startsWith("error") && (
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-700">Errore comunicazione API brand. Contatta l'assistenza.</p>
                </div>
              )}

              <Button className="w-full bg-[#2B7AB8] hover:bg-[#236799]" onClick={closePurchaseDialog} data-testid="close-result-btn">
                Chiudi
              </Button>
            </div>
          )}

          {/* Amount Selection */}
          {selectedCard && !selectedAmount && !purchaseResult && (
            <div className="space-y-4">
              <div className="text-center">
                {selectedCard.logo_url ? (
                  <img src={selectedCard.logo_url} alt={selectedCard.brand} className="w-16 h-16 rounded-2xl mx-auto mb-3 object-contain" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: selectedCard.logo_color + "18" }}>
                    {(() => { const Icon = categoryIcons[selectedCard.category] || Gift; return <Icon className="w-8 h-8" style={{ color: selectedCard.logo_color }} />; })()}
                  </div>
                )}
                <p className="text-sm text-[#6B7280]">{selectedCard.category}</p>
                <p className="text-lg font-bold text-[#E85A24] mt-1">Cashback {selectedCard.cashback_percent}%</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#6B7280] text-center">Seleziona importo (EUR)</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCard.available_amounts.map((amount) => {
                    const cashback = (amount * selectedCard.cashback_percent / 100).toFixed(2);
                    return (
                      <Button key={amount} variant="outline"
                        className="h-auto py-3 flex flex-col gap-1 hover:border-[#E85A24] hover:bg-[#E85A24]/5"
                        onClick={() => setSelectedAmount(amount)}
                        data-testid={`select-amount-${amount}`}
                      >
                        <span className="text-lg font-bold">{amount} EUR</span>
                        <span className="text-[10px] text-[#E85A24] font-medium">+{cashback} UP cashback</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {selectedCard && selectedAmount && !purchaseResult && (
            <div className="space-y-4">
              <div className="bg-[#F5F5F5] rounded-xl p-4 text-center">
                <p className="text-sm text-[#6B7280]">Gift Card {selectedCard.brand}</p>
                <p className="text-2xl font-bold mt-1">{selectedAmount} EUR</p>
                <p className="text-sm text-[#E85A24] font-medium mt-1">
                  +{(selectedAmount * selectedCard.cashback_percent / 100).toFixed(2)} UP cashback
                </p>
              </div>

              <p className="text-xs font-medium text-[#6B7280] text-center">Metodo di pagamento</p>

              {/* Conto UP option */}
              {hasContoUP && (
                <Button
                  className="w-full h-auto py-3 bg-[#2B7AB8] hover:bg-[#236799] text-white"
                  onClick={() => handlePurchase("conto_up")}
                  disabled={purchasing || eurBalance < selectedAmount}
                  data-testid="pay-conto-up"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Wallet className="w-5 h-5 shrink-0" />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-sm">Conto UP</p>
                      <p className="text-xs opacity-80">Saldo: {eurBalance.toFixed(2)} EUR</p>
                    </div>
                    {eurBalance < selectedAmount && (
                      <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded">Insufficiente</span>
                    )}
                  </div>
                </Button>
              )}

              {/* Linked card option */}
              {hasLinkedCard && (
                <Button
                  variant="outline"
                  className="w-full h-auto py-3"
                  onClick={() => handlePurchase("linked_card")}
                  disabled={purchasing}
                  data-testid="pay-linked-card"
                >
                  <div className="flex items-center gap-3 w-full">
                    <CreditCard className="w-5 h-5 shrink-0 text-[#6B7280]" />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-sm">{linkedCard.brand} ****{linkedCard.last_four}</p>
                      <p className="text-xs text-[#6B7280]">{linkedCard.holder_name}</p>
                    </div>
                  </div>
                </Button>
              )}

              {/* Link new card */}
              {!hasLinkedCard && !hasContoUP && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Nessun metodo di pagamento</p>
                    <p className="text-xs text-amber-600 mt-1">Attiva il Conto UP o collega una carta di credito</p>
                  </div>
                </div>
              )}

              {!hasLinkedCard && (
                <Button
                  variant="outline"
                  className="w-full border-dashed border-[#E85A24] text-[#E85A24] hover:bg-[#E85A24]/5"
                  onClick={() => setShowLinkCard(true)}
                  data-testid="link-card-btn"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Collega Carta di Credito
                </Button>
              )}

              <Button variant="ghost" className="w-full text-sm" onClick={() => setSelectedAmount(null)}>
                Cambia importo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Card Dialog */}
      <Dialog open={showLinkCard} onOpenChange={setShowLinkCard}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2B7AB8]" />
              Collega Carta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Numero carta"
              value={linkForm.card_number}
              onChange={(e) => setLinkForm({ ...linkForm, card_number: e.target.value })}
              data-testid="card-number-input"
            />
            <Input
              placeholder="Intestatario"
              value={linkForm.holder_name}
              onChange={(e) => setLinkForm({ ...linkForm, holder_name: e.target.value })}
              data-testid="card-holder-input"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="MM/AA"
                value={linkForm.expiry}
                onChange={(e) => setLinkForm({ ...linkForm, expiry: e.target.value })}
                data-testid="card-expiry-input"
              />
              <Input
                placeholder="CVV"
                type="password"
                value={linkForm.cvv}
                onChange={(e) => setLinkForm({ ...linkForm, cvv: e.target.value })}
                data-testid="card-cvv-input"
              />
            </div>

            <Button
              className="w-full bg-[#2B7AB8] hover:bg-[#236799]"
              onClick={handleLinkCard}
              disabled={linking || !linkForm.card_number || !linkForm.holder_name || !linkForm.expiry || !linkForm.cvv}
              data-testid="confirm-link-card"
            >
              {linking ? "Collegamento..." : "Collega Carta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
