import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Store, Search, ChevronRight, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";

// API
import { merchantAPI, MERCHANT_CATEGORIES } from "@/lib/api";

const CATEGORY_IMAGES = {
  "Ristorante": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
  "Bar/Caffetteria": "https://images.unsplash.com/photo-1573840357491-06851c72e0d1?w=400",
  "Abbigliamento": "https://images.unsplash.com/photo-1766934587163-186d20bf3d40?w=400",
  "Elettronica": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
  "Palestra/Fitness": "https://images.unsplash.com/photo-1761971975769-97e598bf526b?w=400",
  "Bellezza/Spa": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400",
  "Alimentari": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
  "Farmacia": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400",
  "Servizi": "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400",
  "Intrattenimento": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400",
  "Altro": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400"
};

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchants, setMerchants] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const merchantsData = await merchantAPI.getAll();
      setMerchants(merchantsData);
    } catch (err) {
      console.error("Marketplace fetch error:", err);
    }
    setLoading(false);
  };

  const filteredMerchants = merchants.filter(m => {
    const matchesCategory = !selectedCategory || m.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      m.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-heading text-2xl font-bold mb-2 text-[#1A1A1A]">Marketplace</h1>
        <p className="text-[#6B7280] mb-6">Scopri i merchant affiliati</p>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <Input
            placeholder="Cerca negozi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-12 bg-[#F5F5F5] border-black/10 focus:border-[#2B7AB8] rounded-xl text-[#1A1A1A]"
            data-testid="search-input"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`tag-pill whitespace-nowrap ${!selectedCategory ? 'selected' : ''}`}
            data-testid="category-all"
          >
            Tutti
          </button>
          {MERCHANT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`tag-pill whitespace-nowrap ${selectedCategory === cat ? 'selected' : ''}`}
              data-testid={`category-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Merchants Grid */}
      <div className="px-6 py-4">
        {filteredMerchants.length === 0 ? (
          <div className="bg-[#F5F5F5] rounded-2xl p-8 text-center">
            <Store className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
            <p className="text-[#6B7280]">
              {searchQuery || selectedCategory 
                ? "Nessun merchant trovato" 
                : "Nessun merchant registrato"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredMerchants.map((merchant, index) => (
              <button
                key={merchant.id}
                onClick={() => navigate(`/merchant/${merchant.id}`)}
                className="merchant-card text-left animate-slideUp"
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`merchant-${merchant.id}`}
              >
                <div 
                  className="h-32 bg-cover bg-center"
                  style={{ 
                    backgroundImage: `url(${merchant.image_url || CATEGORY_IMAGES[merchant.category] || CATEGORY_IMAGES["Altro"]})`
                  }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-[#1A1A1A]">{merchant.business_name}</h3>
                      <p className="text-sm text-[#6B7280] line-clamp-1">{merchant.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs px-2 py-1 bg-[#2B7AB8]/20 text-[#2B7AB8] rounded-full">
                      {merchant.category}
                    </span>
                    <span className="text-xs text-[#6B7280] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {merchant.address.split(',')[0]}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="marketplace" />
    </div>
  );
}
