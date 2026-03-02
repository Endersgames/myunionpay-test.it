import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { 
  Wallet, QrCode, Scan, Bell, 
  ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";

// API
import { walletAPI, paymentAPI, notificationAPI } from "@/lib/api";
import GiftCardSection from "@/components/GiftCardSection";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      const [walletData, txData, notifData] = await Promise.all([
        walletAPI.getWallet(),
        paymentAPI.getHistory(),
        notificationAPI.getUnreadCount()
      ]);
      
      setWallet(walletData);
      setTransactions(txData.slice(0, 5));
      setUnreadCount(notifData.count);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    try {
      const updatedWallet = await walletAPI.deposit(50);
      setWallet(updatedWallet);
      toast.success("Deposito di 50 UP effettuato!");
      fetchData();
    } catch (err) {
      toast.error("Errore nel deposito");
    }
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[#6B7280] text-sm">Ciao,</p>
            <h1 className="font-heading text-2xl font-bold text-[#1A1A1A]">{user?.full_name?.split(' ')[0]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/notifications")}
              className="relative p-3 bg-[#F5F5F5] rounded-xl border border-black/5"
              data-testid="notifications-btn"
            >
              <Bell className="w-5 h-5 text-[#1A1A1A]" />
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
              <p className="text-white/70 text-sm mb-1">Saldo Disponibile</p>
              <p className="font-mono text-4xl font-bold text-white">
                {wallet?.balance?.toFixed(2) || "0.00"} <span className="text-xl">UP</span>
              </p>
            </div>
            <Wallet className="w-8 h-8 text-white/70" />
          </div>
          <Button
            onClick={handleDeposit}
            variant="outline"
            className="h-10 rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white"
            data-testid="deposit-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ricarica Demo (+50 UP)
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate("/scan")}
            className="bg-[#2B7AB8] rounded-2xl p-5 flex flex-col items-start glow-primary text-white"
            data-testid="scan-btn"
          >
            <Scan className="w-8 h-8 mb-3" />
            <span className="font-semibold text-lg">Scansiona</span>
            <span className="text-sm opacity-80">Paga con QR</span>
          </button>
          <button
            onClick={() => navigate("/qr")}
            className="bg-[#F5F5F5] border border-black/5 rounded-2xl p-5 flex flex-col items-start hover:border-[#2B7AB8]/50 transition-colors"
            data-testid="myqr-btn"
          >
            <QrCode className="w-8 h-8 mb-3 text-[#E85A24]" />
            <span className="font-semibold text-lg text-[#1A1A1A]">Il Mio QR</span>
            <span className="text-sm text-[#6B7280]">Ricevi pagamenti</span>
          </button>
        </div>

        {/* Gift Cards */}
        <GiftCardSection />

        {/* Admin Link */}
        {user?.email === "admin@test.com" && (
          <div className="mt-4 mb-2">
            <Button
              onClick={() => navigate("/admin/giftcards")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-giftcards-btn"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin - Gestisci Gift Card
            </Button>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="mb-6">
          <h2 className="font-heading text-lg font-bold mb-4 text-[#1A1A1A]">Ultime Transazioni</h2>
          {transactions.length === 0 ? (
            <div className="bg-[#F5F5F5] rounded-2xl p-6 text-center">
              <p className="text-[#6B7280]">Nessuna transazione ancora</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const isReceived = tx.recipient_id === user?.id;
                return (
                  <div 
                    key={tx.id}
                    className="bg-[#F5F5F5] rounded-xl p-4 flex items-center justify-between border border-black/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isReceived ? 'bg-[#E85A24]/10' : 'bg-[#2B7AB8]/10'}`}>
                        {isReceived ? (
                          <ArrowDownLeft className="w-5 h-5 text-[#E85A24]" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-[#2B7AB8]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A1A]">
                          {isReceived ? tx.sender_name : tx.recipient_name}
                        </p>
                        <p className="text-sm text-[#6B7280]">{tx.note || "Pagamento"}</p>
                      </div>
                    </div>
                    <p className={`font-mono font-bold ${isReceived ? 'text-[#E85A24]' : 'text-[#1A1A1A]'}`}>
                      {isReceived ? '+' : '-'}{tx.amount.toFixed(2)} UP
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
