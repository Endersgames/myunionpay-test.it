import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { ArrowLeft, Users, Search, Download, Wallet, QrCode, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = process.env.REACT_APP_BACKEND_URL || "";
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });

export default function MerchantReferredUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState({ users: [], total_users: 0, total_transactions: 0, total_rewards: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (q = "") => {
    try {
      const res = await fetch(`${API}/api/merchant/referred-users?search=${q}`, { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => fetchData(e.target.value), 400);
  };

  const handleExport = () => {
    window.open(`${API}/api/merchant/referred-users/export`, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-8" data-testid="merchant-referred-page">
      <div className="bg-white border-b border-black/5 px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/merchant-dashboard")} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="font-bold text-xl text-[#1A1A1A]">Utenti Presentati</h1>
            <p className="text-xs text-[#6B7280]">{data.total_users} utenti tramite il tuo referral</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F5F5F5] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#2B7AB8]">{data.total_users}</p>
            <p className="text-[10px] text-[#6B7280]">Utenti</p>
          </div>
          <div className="bg-[#F5F5F5] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#E85A24]">{data.total_transactions}</p>
            <p className="text-[10px] text-[#6B7280]">Transazioni</p>
          </div>
          <div className="bg-[#F5F5F5] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-emerald-500">{data.total_rewards.toFixed(2)}</p>
            <p className="text-[10px] text-[#6B7280]">UP Reward</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input value={search} onChange={handleSearch} placeholder="Cerca utente..." className="pl-10 h-10 rounded-xl bg-white" data-testid="search-users" />
          </div>
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-xl border-black/10" data-testid="export-csv">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {data.users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-[#6B7280] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280]">Nessun utente presentato ancora</p>
          </div>
        ) : (
          data.users.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden" data-testid={`user-${u.id}`}>
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                <div className="w-10 h-10 rounded-full bg-[#2B7AB8] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(u.full_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1A1A1A] truncate">{u.full_name}</p>
                  <p className="text-xs text-[#6B7280]">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-semibold text-[#1A1A1A]">{u.wallet_balance.toFixed(2)} UP</p>
                  <p className="text-[10px] text-[#6B7280]">{u.transactions_count} tx</p>
                </div>
                {expandedId === u.id ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
              </div>
              {expandedId === u.id && (
                <div className="px-4 pb-4 pt-0 border-t border-black/5 space-y-2" style={{ animation: "myuFadeIn 0.3s ease" }}>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]"><Phone className="w-3.5 h-3.5" />{u.phone || "N/A"}</div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]"><Mail className="w-3.5 h-3.5" />{u.email}</div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]"><QrCode className="w-3.5 h-3.5" />{u.qr_code || "N/A"}</div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]"><Wallet className="w-3.5 h-3.5" />{u.wallet_balance.toFixed(2)} UP</div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#6B7280]">Registrato: {new Date(u.created_at).toLocaleDateString("it-IT")}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.is_blocked ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                      {u.is_blocked ? "Bloccato" : "Attivo"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
