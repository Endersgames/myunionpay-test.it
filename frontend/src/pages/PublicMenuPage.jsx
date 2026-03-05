import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/App";
import { menuAPI } from "@/lib/api";
import { ChevronLeft, Globe, MapPin, Flame, Heart, AlertTriangle, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LANG_LABELS = { it: "Italiano", en: "English", fr: "Francais", de: "Deutsch", es: "Espanol" };
const LANG_FLAGS = { it: "IT", en: "EN", fr: "FR", de: "DE", es: "ES" };
const CAT_LABELS = { antipasti: "Antipasti", primi: "Primi Piatti", secondi: "Secondi", dolci: "Dolci", bevande: "Bevande" };

export default function PublicMenuPage() {
  const { merchantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const ref = searchParams.get("ref");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("it");
  const [activeCategory, setActiveCategory] = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    menuAPI.getPublicMenu(merchantId).then((d) => {
      setData(d);
      const cats = d.categories.filter(c => d.items.some(i => i.category === c));
      if (cats.length > 0) setActiveCategory(cats[0]);
      setLoading(false);
    }).catch(() => { setLoading(false); toast.error("Menu non disponibile"); });
  }, [merchantId]);

  const getText = (obj) => {
    if (!obj) return "";
    return obj[lang] || obj.it || Object.values(obj).find(v => v) || "";
  };

  const handleBack = () => {
    if (!user && ref) {
      navigate(`/register?ref=${ref}`);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#E85A24] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center px-6">
        <p className="text-[#6B7280]">Menu non disponibile</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Indietro</Button>
      </div>
    );
  }

  const { merchant, items } = data;
  const availableCategories = data.categories.filter(c => items.some(i => i.category === c));
  const filteredItems = activeCategory ? items.filter(i => i.category === activeCategory) : items;

  return (
    <div className="min-h-screen bg-[#F5F5F5]" data-testid="public-menu-page">
      {/* Cover Image / Header */}
      <div className="relative">
        {merchant.cover_image_url ? (
          <div className="h-48 overflow-hidden">
            <img src={merchant.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        ) : (
          <div className="h-36 bg-gradient-to-r from-[#1A1A1A] to-[#333]" />
        )}

        {/* Nav bar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10 pb-2">
          <button onClick={handleBack} className="p-2 rounded-full bg-black/30 text-white backdrop-blur-sm" data-testid="menu-back-btn">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 text-white text-xs backdrop-blur-sm"
            data-testid="lang-picker-btn"
          >
            <Globe className="w-3.5 h-3.5" />
            {LANG_FLAGS[lang]}
          </button>
        </div>

        {/* Language picker dropdown */}
        {showLangPicker && (
          <div className="absolute top-20 right-4 bg-white rounded-xl shadow-lg border overflow-hidden z-20">
            {Object.entries(LANG_LABELS).map(([code, label]) => (
              <button
                key={code}
                onClick={() => { setLang(code); setShowLangPicker(false); }}
                className={`w-full px-4 py-2.5 text-sm text-left hover:bg-[#F5F5F5] flex items-center gap-2 ${lang === code ? 'bg-[#2B7AB8]/10 text-[#2B7AB8] font-medium' : 'text-[#1A1A1A]'}`}
                data-testid={`lang-${code}`}
              >
                <span className="text-xs font-mono w-5">{LANG_FLAGS[code]}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Restaurant info */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 text-white">
          <h1 className="text-xl font-bold drop-shadow">{merchant.business_name}</h1>
          {merchant.address && (
            <p className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {merchant.address}
            </p>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 bg-white border-b overflow-x-auto scrollbar-none">
        <div className="flex px-4 gap-1 py-2">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat ? 'bg-[#E85A24] text-white' : 'bg-[#F5F5F5] text-[#6B7280] hover:bg-[#E5E5E5]'
              }`}
              data-testid={`cat-tab-${cat}`}
            >
              {CAT_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 py-4 space-y-3 pb-24">
        {filteredItems.length === 0 && (
          <p className="text-center text-[#6B7280] text-sm py-8">Nessun piatto in questa categoria</p>
        )}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-black/5 overflow-hidden"
            data-testid={`menu-item-${item.id}`}
          >
            <div className="flex">
              {/* Image */}
              {item.image_url && (
                <div className="w-24 h-24 shrink-0">
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              {/* Content */}
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-[#1A1A1A] leading-tight">{getText(item.name)}</h3>
                  <span className="text-sm font-bold text-[#E85A24] shrink-0">{item.price.toFixed(2)} EUR</span>
                </div>
                {getText(item.description) && (
                  <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{getText(item.description)}</p>
                )}
                {/* Meta row */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {item.origin && (
                    <span className="text-[10px] text-[#6B7280] flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" /> {item.origin}
                    </span>
                  )}
                  {item.calories && (
                    <span className="text-[10px] text-[#6B7280] flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> {item.calories} kcal
                    </span>
                  )}
                </div>
                {/* Health info */}
                {item.health && (
                  <div className="mt-2 space-y-1">
                    {item.health.recommended_for && getText(item.health.recommended_for) && (
                      <p className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 mr-1">
                        <Heart className="w-3 h-3" /> {getText(item.health.recommended_for)}
                      </p>
                    )}
                    {item.health.not_recommended_for && getText(item.health.not_recommended_for) && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> {getText(item.health.not_recommended_for)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA for unregistered users */}
      {!user && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t px-4 py-3 flex gap-2">
          <Button
            className="flex-1 bg-[#E85A24] hover:bg-[#D14E1A] text-sm"
            onClick={() => navigate(`/register?ref=${ref || merchant.qr_code}`)}
            data-testid="register-cta-btn"
          >
            Registrati e ottieni 1 UP
          </Button>
        </div>
      )}
    </div>
  );
}
