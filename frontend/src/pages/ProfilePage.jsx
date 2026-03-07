import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  User, Copy, Share2, 
  LogOut, Store, Users, Tag, ChevronRight, Smartphone, Wifi, Phone, Signal, CreditCard, Gift,
  ClipboardCheck, Upload, FileCheck, Zap, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

// API
import { profileAPI, referralAPI, simAPI, tasksAPI, PROFILE_TAGS } from "@/lib/api";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [myTags, setMyTags] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [sim, setSim] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [uploadingTask, setUploadingTask] = useState(null);
  const [showTags, setShowTags] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const [tagsData, refStats, simData, tasksData] = await Promise.all([
        profileAPI.getMyTags(),
        referralAPI.getStats(),
        simAPI.getMySim(),
        tasksAPI.getMyTasks()
      ]);
      setMyTags(tagsData.tags || []);
      setReferralStats(refStats);
      setSim(simData);
      setTasks(tasksData || []);
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
      await profileAPI.updateTags(newTags);
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
          title: "Unisciti a myUup.com",
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

  const handleFileUpload = async (taskId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTask(taskId);
    try {
      const result = await tasksAPI.uploadDocument(taskId, file);
      toast.success(result.message);
      await fetchData();
      await refreshUser();
    } catch (err) {
      toast.error(err.message || "Errore nel caricamento");
    }
    setUploadingTask(null);
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
        <h1 className="font-heading text-2xl font-bold mb-6 text-[#1A1A1A]">Profilo</h1>

        {/* User Card */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] flex items-center justify-center">
              <span className="font-heading text-2xl font-bold text-white">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-[#1A1A1A]">{user?.full_name}</h2>
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
              <p className="font-mono text-xl font-bold text-[#1A1A1A]">{referralStats?.total_referrals || 0}</p>
              <p className="text-xs text-[#6B7280]">Invitati</p>
            </div>
          </div>
        </div>

        {/* Referral Section */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-[#E85A24]" />
            <h3 className="font-semibold text-[#1A1A1A]">Invita Amici</h3>
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

        {/* Tasks Section */}
        <div className="bg-[#F5F5F5] rounded-2xl p-5 border border-black/5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardCheck className="w-5 h-5 text-[#2B7AB8]" />
            <h3 className="font-semibold text-[#1A1A1A]">Task</h3>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Nessun task disponibile</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-xl p-4 border ${
                    task.status === "verified"
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-black/5"
                  }`}
                  data-testid={`task-${task.task_type}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      task.status === "verified"
                        ? "bg-green-100"
                        : "bg-[#E85A24]/10"
                    }`}>
                      {task.status === "verified" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileCheck className="w-5 h-5 text-[#E85A24]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-sm text-[#1A1A1A]">{task.title}</h4>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          task.status === "verified"
                            ? "bg-green-100 text-green-700"
                            : "bg-[#E85A24]/10 text-[#E85A24]"
                        }`}>
                          {task.status === "verified" ? "Completato" : `+${task.reward_up} UP`}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mb-3">{task.description}</p>

                      {task.status === "verified" ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <Zap className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            +{task.reward_up} UP ricevuti
                            {task.file_name && ` - ${task.file_name}`}
                          </span>
                        </div>
                      ) : (
                        <label
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                            uploadingTask === task.id
                              ? "bg-gray-200 text-gray-500"
                              : "bg-[#E85A24] text-white hover:bg-[#D14E1A]"
                          }`}
                          data-testid={`upload-btn-${task.task_type}`}
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingTask === task.id ? "Caricamento..." : "Carica Fattura"}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleFileUpload(task.id, e)}
                            disabled={uploadingTask === task.id}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conto UP Section */}
        {sim ? (
          <button
            onClick={() => navigate("/sim-dashboard")}
            className="w-full bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-2xl p-5 mb-6 text-white text-left relative overflow-hidden"
            data-testid="sim-dashboard-btn"
          >
            {/* Card pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85A24] to-[#D14E1A] flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Conto UP</h3>
                    <p className="text-sm text-white/60">Card + SIM attiva</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/50" />
              </div>
              
              {/* Mini card preview */}
              <div className="bg-gradient-to-r from-[#2B7AB8] to-[#1E5F8A] rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm tracking-wider">•••• •••• •••• {sim.phone_number?.slice(-4) || '0000'}</span>
                  <img src="/logo.png" alt="UP" className="h-5 opacity-80" />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/10 rounded-lg p-2">
                  <Phone className="w-4 h-4 mx-auto mb-1 opacity-70" />
                  <p className="text-xs font-semibold">Illimitati</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs font-semibold">{sim.sms_total - sim.sms_used}</p>
                  <p className="text-xs opacity-70">SMS</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-xs font-semibold">{(sim.gb_total - sim.gb_used).toFixed(1)}</p>
                  <p className="text-xs opacity-70">GB</p>
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-2xl p-5 mb-6 text-white relative overflow-hidden">
            {/* Card pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E85A24] to-[#D14E1A] flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Attiva il Conto UP</h3>
                  <div className="flex items-center gap-1 text-[#E85A24]">
                    <Gift className="w-4 h-4" />
                    <span className="text-sm font-medium">SIM voce e dati in omaggio</span>
                  </div>
                </div>
              </div>
              
              {/* Card Preview */}
              <div className="bg-gradient-to-r from-[#2B7AB8] to-[#1E5F8A] rounded-xl p-4 mb-4 relative">
                <div className="flex items-center justify-between mb-6">
                  <img src="/logo.png" alt="UP" className="h-6" />
                  <span className="text-xs text-white/60">DEBIT</span>
                </div>
                <div className="font-mono text-lg tracking-widest mb-4 text-white/80">
                  •••• •••• •••• ••••
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-white/50 text-xs">INTESTATARIO</p>
                    <p className="font-medium">IL TUO NOME</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-xs">SCADENZA</p>
                    <p className="font-medium">••/••</p>
                  </div>
                </div>
              </div>
              
              {/* Benefits */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <CreditCard className="w-5 h-5 mx-auto mb-1 text-[#E85A24]" />
                  <p className="text-xs font-medium">Card Fisica</p>
                  <p className="text-xs text-white/50">Gratis</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <Smartphone className="w-5 h-5 mx-auto mb-1 text-[#2B7AB8]" />
                  <p className="text-xs font-medium">SIM 100GB</p>
                  <p className="text-xs text-white/50">In omaggio</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-white/60">Attivazione</span>
                <span className="font-mono text-2xl font-bold text-[#E85A24]">15,99€</span>
              </div>
              
              <Button
                onClick={() => navigate("/sim-activation")}
                className="w-full h-12 rounded-full bg-[#E85A24] hover:bg-[#D14E1A] text-white font-semibold"
                data-testid="activate-sim-btn"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Attiva il Conto UP
              </Button>
            </div>
          </div>
        )}

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
                <h3 className="font-semibold text-[#1A1A1A]">I Miei Interessi</h3>
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
                <h3 className="font-semibold text-[#1A1A1A]">Dashboard Merchant</h3>
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
                <h3 className="font-semibold text-[#1A1A1A]">Diventa Merchant</h3>
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
