import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift } from "lucide-react";
import { giftcardAPI } from "@/lib/api";

export default function MieGiftCardPage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    giftcardAPI.getMyPurchases().then(data => {
      setPurchases(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

      <div className="flex items-center gap-3 mb-6">
        <Gift className="w-6 h-6 text-[#2B7AB8]" />
        <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">Le mie Gift Card</h1>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-[#F5F5F5] rounded-2xl p-8 text-center">
          <Gift className="w-12 h-12 text-[#6B7280] mx-auto mb-4 opacity-50" />
          <p className="text-[#6B7280] font-medium">Nessuna gift card acquistata</p>
          <p className="text-sm text-[#6B7280] mt-1">Le tue gift card appariranno qui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase, idx) => (
            <div
              key={purchase.id || idx}
              className="bg-[#F5F5F5] rounded-2xl p-4 border border-black/5"
              data-testid={`giftcard-purchase-${idx}`}
            >
              <div className="flex items-center gap-4">
                {purchase.logo_url ? (
                  <img src={purchase.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-white p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#2B7AB8]/10 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-[#2B7AB8]" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-[#1A1A1A]">{purchase.brand_name || "Gift Card"}</p>
                  <p className="text-sm text-[#6B7280]">
                    {purchase.created_at ? new Date(purchase.created_at).toLocaleDateString('it-IT') : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-[#1A1A1A]">
                    {purchase.amount?.toFixed(2)} EUR
                  </p>
                  <p className={`text-xs font-medium ${
                    purchase.status === "completed" ? "text-green-600" : "text-[#E85A24]"
                  }`}>
                    {purchase.status === "completed" ? "Completata" : purchase.status}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
