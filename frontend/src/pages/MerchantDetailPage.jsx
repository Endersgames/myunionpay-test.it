import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/App";
import { ArrowLeft, MapPin, QrCode, Send, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "@/components/QRCode";

// Firestore
import { getMerchantById } from "@/lib/firestore";

const CATEGORY_IMAGES = {
  "Ristorante": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
  "Bar/Caffetteria": "https://images.unsplash.com/photo-1573840357491-06851c72e0d1?w=800",
  "Abbigliamento": "https://images.unsplash.com/photo-1766934587163-186d20bf3d40?w=800",
  "Elettronica": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
  "Palestra/Fitness": "https://images.unsplash.com/photo-1761971975769-97e598bf526b?w=800",
  "Bellezza/Spa": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800",
  "Alimentari": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
  "Farmacia": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800",
  "Servizi": "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800",
  "Intrattenimento": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
  "Altro": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800"
};

export default function MerchantDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchMerchant();
  }, [id]);

  const fetchMerchant = async () => {
    try {
      const merchantData = await getMerchantById(id);
      setMerchant(merchantData);
    } catch (err) {
      console.error("Merchant fetch error:", err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <button 
          onClick={() => navigate("/marketplace")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1A1A] mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Marketplace</span>
        </button>
        <div className="text-center mt-20">
          <Store className="w-16 h-16 text-[#6B7280] mx-auto mb-4" />
          <p className="text-[#6B7280]">Merchant non trovato</p>
        </div>
      </div>
    );
  }

  const imageUrl = merchant.image_url || CATEGORY_IMAGES[merchant.category] || CATEGORY_IMAGES["Altro"];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Image */}
      <div className="relative h-64">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
        <button 
          onClick={() => navigate("/marketplace")}
          className="absolute top-8 left-6 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 -mt-8 relative z-10">
        <div className="mb-6">
          <span className="text-xs px-3 py-1 bg-[#2B7AB8]/20 text-[#2B7AB8] rounded-full">
            {merchant.category}
          </span>
          <h1 className="font-heading text-3xl font-bold mt-3 mb-2">{merchant.business_name}</h1>
          <p className="text-[#6B7280] flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {merchant.address}
          </p>
        </div>

        <p className="text-[#6B7280] mb-8">{merchant.description}</p>

        {/* Actions */}
        <div className="space-y-3 mb-8">
          <Button
            onClick={() => navigate(`/pay/${merchant.qr_code}`)}
            className="w-full h-14 rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-lg font-semibold glow-primary"
            data-testid="pay-merchant-btn"
          >
            <Send className="w-5 h-5 mr-2" />
            Paga Questo Negozio
          </Button>
          <Button
            onClick={() => setShowQR(!showQR)}
            variant="outline"
            className="w-full h-14 rounded-full border-black/20 bg-transparent hover:bg-white/5"
            data-testid="show-qr-btn"
          >
            <QrCode className="w-5 h-5 mr-2" />
            {showQR ? "Nascondi QR" : "Mostra QR Code"}
          </Button>
        </div>

        {/* QR Code Display */}
        {showQR && (
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center mb-8 animate-slideUp">
            <QRCode value={merchant.qr_code} size={180} />
            <p className="font-mono text-[#050505] mt-4 text-sm">{merchant.qr_code}</p>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-8">
          <h3 className="font-semibold mb-3">Informazioni</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Categoria</span>
              <span>{merchant.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">ID Merchant</span>
              <span className="font-mono text-xs">{merchant.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
