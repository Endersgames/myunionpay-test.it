import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  User, Copy, Share2, 
  LogOut, Store, Users, Tag, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

// Firestore
import { 
  updateUserTags, 
  getReferralStats,
  PROFILE_TAGS 
} from "@/lib/firestore";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [myTags, setMyTags] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [showTags, setShowTags] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setMyTags(user?.profile_tags || []);
      const refStats = await getReferralStats(user.id, user);
      setReferralStats(refStats);
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
      await updateUserTags(user.id, newTags);
      await refreshUser();
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
          title: "Unisciti a My Union Pay",
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

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

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
        <h1 className="font-heading text-2xl font-bold mb-6">Profilo</h1>

        {/* User Card */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] flex items-center justify-center">
              <span className="font-heading text-2xl font-bold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user?.full_name}</h2>
              <p className="text-sm text-[#6B7280]">{user?.email}</p>
              <p className="text-sm text-[#6B7280]">{user?.phone}</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 bg-white rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold text-[#E85A24]">{user?.up_points || 0}</p>
              <p className="text-xs text-[#6B7280]">UP Points</p>
            </div>
            <div className="flex-1 bg-white rounded-xl p-3 text-center">
              <p className="font-mono text-xl font-bold">{referralStats?.total_referrals || 0}</p>
              <p className="text-xs text-[#6B7280]">Invitati</p>
            </div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-[#E85A24]" />
            <h3 className="font-semibold">Invita Amici</h3>
          </div>
          <p className="text-sm text-[#6B7280] mb-4">
            Condividi il tuo codice e guadagna 1 UP per ogni amico che si registra!
          </p>
          <div className="bg-white rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="font-mono text-[#2B7AB8]">{user?.referral_code}</span>
            <button 
              onClick={handleCopyReferral}
              className="text-[#6B7280] hover:text-[#1A1A1A]"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={handleShare}
            className="w-full h-12 rounded-full bg-[#2B7AB8] hover:bg-[#236699]"
            data-testid="share-referral-btn"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Condividi Link
          </Button>
        </div>

        {/* Profile Tags */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <button 
            onClick={() => setShowTags(!showTags)}
            className="w-full flex items-center justify-between"
            data-testid="toggle-tags-btn"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-[#2B7AB8]" />
              <div className="text-left">
                <h3 className="font-semibold">I Miei Interessi</h3>
                <p className="text-sm text-[#6B7280]">
                  {myTags.length > 0 ? `${myTags.length} selezionati` : "Nessuno selezionato"}
                </p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-[#6B7280] transition-transform ${showTags ? 'rotate-90' : ''}`} />
          </button>
          
          {showTags && (
            <div className="mt-4 pt-4 border-t border-black/5">
              <p className="text-sm text-[#6B7280] mb-3">
                Seleziona i tuoi interessi per ricevere notifiche personalizzate dai merchant
              </p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_TAGS.map((tag) => (
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
            className="w-full bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6 flex items-center justify-between"
            data-testid="merchant-dashboard-btn"
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-[#E85A24]" />
              <div className="text-left">
                <h3 className="font-semibold">Dashboard Merchant</h3>
                <p className="text-sm text-[#6B7280]">Gestisci il tuo negozio</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/merchant-dashboard")}
            className="w-full bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6 flex items-center justify-between"
            data-testid="become-merchant-btn"
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-[#2B7AB8]" />
              <div className="text-left">
                <h3 className="font-semibold">Diventa Merchant</h3>
                <p className="text-sm text-[#6B7280]">Registra la tua attività</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#6B7280]" />
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
