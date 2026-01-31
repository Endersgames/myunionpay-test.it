import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import { 
  Wallet, QrCode, Scan, Store, Bell, User, 
  ArrowUpRight, ArrowDownLeft, Plus, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [walletRes, txRes, notifRes] = await Promise.all([
        axios.get(`${API}/wallet`, { headers }),
        axios.get(`${API}/payments/history`, { headers }),
        axios.get(`${API}/notifications/unread-count`, { headers })
      ]);
      setWallet(walletRes.data);
      setTransactions(txRes.data.slice(0, 5));
      setUnreadCount(notifRes.data.count);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleDeposit = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/wallet/deposit`, { amount: 50 }, { headers });
      toast.success("Deposito di €50 effettuato!");
      fetchData();
    } catch (err) {
      toast.error("Errore nel deposito");
    }
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[#A1A1AA] text-sm">Ciao,</p>
            <h1 className="font-heading text-2xl font-bold">{user?.full_name?.split(' ')[0]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/notifications")}
              className="relative p-3 bg-[#121212] rounded-xl border border-white/5"
              data-testid="notifications-btn"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
            <div className="up-badge flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {user?.up_points || 0} UP
            </div>
          </div>
        </div>

        {/* Wallet Card */}
        <div className="wallet-card mb-6 animate-slideUp" data-testid="wallet-card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[#A1A1AA] text-sm mb-1">Saldo Disponibile</p>
              <p className="font-mono text-4xl font-bold">
                €{wallet?.balance?.toFixed(2) || "0.00"}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-[#7C3AED]" />
          </div>
          <Button
            onClick={handleDeposit}
            variant="outline"
            className="h-10 rounded-full border-white/20 bg-white/5 hover:bg-white/10"
            data-testid="deposit-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ricarica Demo
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate("/scan")}
            className="bg-[#7C3AED] rounded-2xl p-5 flex flex-col items-start glow-primary"
            data-testid="scan-btn"
          >
            <Scan className="w-8 h-8 mb-3" />
            <span className="font-semibold text-lg">Scansiona</span>
            <span className="text-sm opacity-80">Paga con QR</span>
          </button>
          <button
            onClick={() => navigate("/qr")}
            className="bg-[#121212] border border-white/10 rounded-2xl p-5 flex flex-col items-start hover:border-[#7C3AED]/50 transition-colors"
            data-testid="myqr-btn"
          >
            <QrCode className="w-8 h-8 mb-3 text-[#CCFF00]" />
            <span className="font-semibold text-lg">Il Mio QR</span>
            <span className="text-sm text-[#A1A1AA]">Ricevi pagamenti</span>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="mb-6">
          <h2 className="font-heading text-lg font-bold mb-4">Ultime Transazioni</h2>
          {transactions.length === 0 ? (
            <div className="bg-[#121212] rounded-2xl p-6 text-center">
              <p className="text-[#A1A1AA]">Nessuna transazione ancora</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isReceived = tx.recipient_id === user?.id;
                return (
                  <div 
                    key={tx.id}
                    className="bg-[#121212] rounded-xl p-4 flex items-center justify-between border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isReceived ? 'bg-[#CCFF00]/10' : 'bg-[#7C3AED]/10'}`}>
                        {isReceived ? (
                          <ArrowDownLeft className="w-5 h-5 text-[#CCFF00]" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-[#7C3AED]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {isReceived ? tx.sender_name : tx.recipient_name}
                        </p>
                        <p className="text-sm text-[#A1A1AA]">{tx.note || "Pagamento"}</p>
                      </div>
                    </div>
                    <p className={`font-mono font-bold ${isReceived ? 'text-[#CCFF00]' : ''}`}>
                      {isReceived ? '+' : '-'}€{tx.amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="home" unreadCount={unreadCount} />
    </div>
  );
}
