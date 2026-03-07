import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Search, Shield, ShieldOff, Edit2, Save, X,
  Wallet, Store, ChevronDown, ChevronUp, Mail, Phone, QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API = process.env.REACT_APP_BACKEND_URL || "";
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });

const STATUS_FILTERS = [
  { id: "all", label: "Tutti" },
  { id: "active", label: "Attivi" },
  { id: "blocked", label: "Bloccati" },
  { id: "merchant", label: "Merchant" },
  { id: "admin", label: "Admin" },
];

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUsers(); }, [filter]);

  const fetchUsers = async (q = search) => {
    try {
      const res = await fetch(`${API}/api/admin/users?search=${q}&status=${filter}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setUsers(d.users); setTotal(d.total); }
    } catch {}
    setLoading(false);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    clearTimeout(window._searchTimeout);
    window._searchTimeout = setTimeout(() => fetchUsers(e.target.value), 400);
  };

  const handleBlock = async (userId, block) => {
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}/${block ? "block" : "unblock"}`, { method: "POST", headers: authHeaders() });
      if (res.ok) {
        toast.success(block ? "Utente bloccato" : "Utente sbloccato");
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: block } : u));
      }
    } catch { toast.error("Errore"); }
  };

  const openEdit = async (userId) => {
    try {
      const res = await fetch(`${API}/api/admin/user/${userId}`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setEditUser(d);
        setEditForm({ full_name: d.full_name, email: d.email, phone: d.phone || "" });
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/user/${editUser.id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(editForm)
      });
      if (res.ok) {
        toast.success("Utente aggiornato");
        setEditUser(null);
        fetchUsers();
      }
    } catch { toast.error("Errore"); }
    setSaving(false);
  };

  if (!user?.is_admin) return <div className="min-h-screen flex items-center justify-center"><p>Accesso negato</p></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-8" data-testid="admin-users-page">
      <div className="bg-white border-b border-black/5 px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/admin/giftcards")} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="font-bold text-xl text-[#1A1A1A]">Gestione Utenti</h1>
            <p className="text-xs text-[#6B7280]">{total} utenti totali</p>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input value={search} onChange={handleSearch} placeholder="Cerca per nome, email, telefono..." className="pl-10 h-10 rounded-xl bg-[#F5F5F5]" data-testid="admin-search" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${filter === f.id ? "bg-[#2B7AB8] text-white" : "bg-[#F5F5F5] text-[#6B7280]"}`}
              data-testid={`filter-${f.id}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden" data-testid={`admin-user-${u.id}`}>
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${u.is_blocked ? "bg-red-500" : u.is_admin ? "bg-purple-500" : u.is_merchant ? "bg-[#E85A24]" : "bg-[#2B7AB8]"}`}>
                {(u.full_name || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm text-[#1A1A1A] truncate">{u.full_name}</p>
                  {u.is_admin && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-600">ADMIN</span>}
                  {u.is_merchant && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E85A24]/10 text-[#E85A24]">MERCHANT</span>}
                  {u.is_blocked && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">BLOCCATO</span>}
                </div>
                <p className="text-xs text-[#6B7280] truncate">{u.email}</p>
              </div>
              <p className="text-xs font-mono text-[#1A1A1A] flex-shrink-0">{u.wallet_balance?.toFixed(2)} UP</p>
              {expandedId === u.id ? <ChevronUp className="w-4 h-4 text-[#6B7280]" /> : <ChevronDown className="w-4 h-4 text-[#6B7280]" />}
            </div>

            {expandedId === u.id && (
              <div className="px-3 pb-3 border-t border-black/5" style={{ animation: "myuFadeIn 0.3s ease" }}>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-[#6B7280]">
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{u.email}</div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{u.phone || "N/A"}</div>
                  <div className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{u.wallet_balance?.toFixed(2)} UP</div>
                  <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{u.referrals_count} referral</div>
                  <div className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" />{u.transactions_count} tx</div>
                  {u.merchant_name && <div className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" />{u.merchant_name}</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 flex-1" onClick={() => openEdit(u.id)} data-testid="edit-user-btn">
                    <Edit2 className="w-3.5 h-3.5 mr-1" />Modifica
                  </Button>
                  {u.is_blocked ? (
                    <Button size="sm" className="rounded-xl text-xs h-8 flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleBlock(u.id, false)} data-testid="unblock-btn">
                      <ShieldOff className="w-3.5 h-3.5 mr-1" />Sblocca
                    </Button>
                  ) : (
                    <Button size="sm" className="rounded-xl text-xs h-8 flex-1 bg-red-500 hover:bg-red-600" onClick={() => handleBlock(u.id, true)} data-testid="block-btn">
                      <Shield className="w-3.5 h-3.5 mr-1" />Blocca
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Modifica Utente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#6B7280]">Nome</label>
              <Input value={editForm.full_name || ""} onChange={(e) => setEditForm(p => ({ ...p, full_name: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280]">Email</label>
              <Input value={editForm.email || ""} onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280]">Telefono</label>
              <Input value={editForm.phone || ""} onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))} className="h-10 rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditUser(null)}><X className="w-4 h-4 mr-1" />Annulla</Button>
              <Button className="flex-1 rounded-xl bg-[#2B7AB8]" onClick={handleSave} disabled={saving} data-testid="save-user-btn">
                <Save className="w-4 h-4 mr-1" />{saving ? "..." : "Salva"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
