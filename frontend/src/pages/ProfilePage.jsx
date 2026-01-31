import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { 
  ArrowLeft, User, Copy, Share2, Settings, 
  LogOut, Store, TrendingUp, Users, Tag, ChevronRight, Bell, BellOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import usePushNotifications from "@/hooks/usePushNotifications";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, refreshUser } = useAuth();
  const [availableTags, setAvailableTags] = useState([]);
  const [myTags, setMyTags] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [showTags, setShowTags] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    permission: pushPermission,
    subscribe: subscribePush, 
    unsubscribe: unsubscribePush 
  } = usePushNotifications(token);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [tagsRes, myTagsRes, refRes] = await Promise.all([
        axios.get(`${API}/profile/tags`, { headers }),
        axios.get(`${API}/profile/my-tags`, { headers }),
        axios.get(`${API}/referrals/stats`, { headers })
      ]);
      setAvailableTags(tagsRes.data);
      setMyTags(myTagsRes.data.tags);
      setReferralStats(refRes.data);
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
    setLoading(false);
  };

  const toggleTag = async (tag) => {
    const newTags = myTags.includes(tag) 
      ? myTags.filter(t => t !== tag)
      : [...myTags, tag];
    
    setMyTags(newTags);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/profile/tags`, { tags: newTags }, { headers });
      toast.success("Interessi aggiornati");
    } catch (err) {
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleCopyReferral = () => {
    const url = `${window.location.origin}/register?ref=${user?.referral_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link referral copiato!");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/register?ref=${user?.referral_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Unisciti a UpPay",
          text: `Registrati con il mio codice referral e guadagna 1 UP!`,
          url
        });
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      handleCopyReferral();
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="font-heading text-2xl font-bold mb-6">Profilo</h1>

        {/* User Card */}
        <div className="bg-[#121212] rounded-2xl p-5 border border-white/5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] flex items-center justify-center">
              <span className="font-heading text-2xl font-bold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user?.full_name}</h2>
              <p className="text-sm text-[#A1A1AA]">{user?.email}</p>
              <p className="text-sm text-[#A1A1AA]">{user?.phone}</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 bg-[#050505] rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-[#CCFF00]">{user?.up_points || 0}</p>
              <p className="text-xs text-[#A1A1AA]">UP Points</p>
            </div>
            <div className="flex-1 bg-[#050505] rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold">{referralStats?.total_referrals || 0}</p>
              <p className="text-xs text-[#A1A1AA]">Invitati</p>
            </div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-[#121212] rounded-2xl p-5 border border-white/5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-[#CCFF00]" />
            <h3 className="font-semibold">Invita Amici</h3>
          </div>
          <p className="text-sm text-[#A1A1AA] mb-4">
            Condividi il tuo codice e guadagna 1 UP per ogni amico che si registra!
          </p>
          <div className="bg-[#050505] rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="font-mono text-[#7C3AED]">{user?.referral_code}</span>
            <button 
              onClick={handleCopyReferral}
              className="text-[#A1A1AA] hover:text-white"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={handleShare}
            className="w-full h-12 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9]"
            data-testid="share-referral-btn"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Condividi Link
          </Button>
        </div>

        {/* Profile Tags */}
        <div className="bg-[#121212] rounded-2xl p-5 border border-white/5 mb-6">
          <button 
            onClick={() => setShowTags(!showTags)}
            className="w-full flex items-center justify-between"
            data-testid="toggle-tags-btn"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-[#7C3AED]" />
              <div className="text-left">
                <h3 className="font-semibold">I Miei Interessi</h3>
                <p className="text-sm text-[#A1A1AA]">
                  {myTags.length > 0 ? `${myTags.length} selezionati` : "Nessuno selezionato"}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-[#A1A1AA] transition-transform ${showTags ? 'rotate-90' : ''}`} />
          </button>
          
          {showTags && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-sm text-[#A1A1AA] mb-3">
                Seleziona i tuoi interessi per ricevere notifiche personalizzate dai merchant
              </p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`tag-pill ${myTags.includes(tag) ? 'selected' : ''}`}
                    data-testid={`tag-${tag}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Merchant Section */}
        {user?.is_merchant ? (
          <button
            onClick={() => navigate("/merchant-dashboard")}
            className="w-full bg-[#121212] rounded-2xl p-5 border border-white/5 mb-6 flex items-center justify-between"
            data-testid="merchant-dashboard-btn"
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-[#CCFF00]" />
              <div className="text-left">
                <h3 className="font-semibold">Dashboard Merchant</h3>
                <p className="text-sm text-[#A1A1AA]">Gestisci il tuo negozio</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/merchant-dashboard")}
            className="w-full bg-[#121212] rounded-2xl p-5 border border-white/5 mb-6 flex items-center justify-between"
            data-testid="become-merchant-btn"
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-[#7C3AED]" />
              <div className="text-left">
                <h3 className="font-semibold">Diventa Merchant</h3>
                <p className="text-sm text-[#A1A1AA]">Registra la tua attività</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
          </button>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full h-12 rounded-full border-[#FF3B30]/30 text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30]"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Esci
        </Button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
