import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { 
  Wallet, QrCode, Scan, Bell, 
  ArrowUpRight, ArrowDownLeft, Plus, TrendingUp, Settings,
  CreditCard, Gift, Users, Bot, ToggleLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";

// API
import { adminAPI, walletAPI, paymentAPI, notificationAPI } from "@/lib/api";
import GiftCardSection from "@/components/GiftCardSection";

const formatNumber = (value, fractionDigits = 0) =>
  new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value || 0);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllTx, setShowAllTx] = useState(false);
  const liveWalletBalance = Number(wallet?.balance ?? user?.wallet_balance ?? 0);
  const totalWalletBalance = Number(adminSummary?.total_wallet_balance ?? adminSummary?.circulating_debt ?? 0);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      if (user?.is_admin) {
        const [summaryData, notifData] = await Promise.all([
          adminAPI.getDashboardSummary(),
          notificationAPI.getUnreadCount(),
        ]);

        setAdminSummary(summaryData);
        setTransactions((summaryData.recent_transactions || []).slice(0, 15));
        setUnreadCount(notifData.count);
        setWallet(null);
      } else {
        const [walletData, txData, notifData] = await Promise.all([
          walletAPI.getWallet(),
          paymentAPI.getHistory(),
          notificationAPI.getUnreadCount()
        ]);
        
        setWallet(walletData);
        setTransactions(txData.slice(0, 15));
        setUnreadCount(notifData.count);
        setAdminSummary(null);
      }
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
            {user?.is_admin ? (
              <button
                onClick={() => navigate("/admin/myu-training")}
                className="up-badge flex items-center gap-1 hover:opacity-90 transition-opacity"
                data-testid="myu-training-btn"
              >
                <Bot className="w-4 h-4" />
                MYU Training
              </button>
            ) : (
              <div className="up-badge flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {liveWalletBalance.toFixed(2)} UP
              </div>
            )}
          </div>
        </div>

        {user?.is_admin ? (
          <div className="wallet-card mb-6 animate-slideUp" data-testid="wallet-card">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white/70 text-sm mb-1">Saldo Totale Wallet</p>
                  <p className="font-mono text-4xl font-bold text-white">
                    {formatNumber(totalWalletBalance, 2)} <span className="text-xl">UP</span>
                  </p>
                  <p className="text-white/75 text-sm mt-3 max-w-md">
                    Somma matematica di tutti i wallet della piattaforma, inclusi bonus referral, reward e wallet admin.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                      Utenti: {formatNumber(adminSummary?.user_wallet_balance, 2)} UP
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                      Admin: {formatNumber(adminSummary?.admin_wallet_balance, 2)} UP
                    </span>
                  </div>
                </div>
                <Wallet className="w-8 h-8 text-white/70 shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Transazioni 24h</p>
                  <p className="font-mono text-2xl font-bold text-white">
                    {formatNumber(adminSummary?.transactions_last_24h)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Volume Totale</p>
                  <p className="font-mono text-2xl font-bold text-white">
                    {formatNumber(adminSummary?.total_volume, 2)} UP
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Valore Medio</p>
                  <p className="font-mono text-2xl font-bold text-white">
                    {formatNumber(adminSummary?.average_transaction_value, 2)} UP
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-white/70 text-xs uppercase tracking-wide mb-1">Utenti Totali</p>
                  <p className="font-mono text-2xl font-bold text-white">
                    {formatNumber(adminSummary?.total_users)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
        )}

        {!user?.is_admin && (
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
        )}

        {/* Recent Transactions */}
        <div className="mb-6" data-testid="transactions-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-[#1A1A1A]">
              {user?.is_admin ? "Transazioni Piattaforma" : "Ultime Transazioni"}
            </h2>
            {transactions.length > 3 && (
              <button
                onClick={() => setShowAllTx(!showAllTx)}
                className="text-sm font-medium text-[#2B7AB8] hover:underline"
                data-testid="expand-tx-btn"
              >
                {showAllTx ? "Mostra meno" : `Vedi tutte (${transactions.length})`}
              </button>
            )}
          </div>
          {transactions.length === 0 ? (
            <div className="bg-[#F5F5F5] rounded-2xl p-6 text-center">
              <p className="text-[#6B7280]">Nessuna transazione ancora</p>
            </div>
          ) : (
            <div className={`space-y-3 ${showAllTx ? "max-h-[400px] overflow-y-auto pr-1" : ""}`}>
              {(showAllTx ? transactions : transactions.slice(0, 3)).map((tx, idx) => {
                const isReceived = tx.type === "received";
                const isCard = tx.type === "card_payment";
                const isGift = tx.type === "giftcard";
                const isPlatform = tx.type === "platform";

                let iconBg, icon, amountColor, amountPrefix, amountSuffix;
                if (isPlatform) {
                  iconBg = "bg-[#2B7AB8]/10";
                  icon = <Wallet className="w-5 h-5 text-[#2B7AB8]" />;
                  amountColor = "text-[#1A1A1A]";
                  amountPrefix = "";
                  amountSuffix = "UP";
                } else if (isReceived) {
                  iconBg = "bg-[#E85A24]/10";
                  icon = <ArrowDownLeft className="w-5 h-5 text-[#E85A24]" />;
                  amountColor = "text-[#E85A24]";
                  amountPrefix = "+";
                  amountSuffix = "UP";
                } else if (isCard) {
                  iconBg = "bg-purple-100";
                  icon = <CreditCard className="w-5 h-5 text-purple-600" />;
                  amountColor = "text-purple-600";
                  amountPrefix = "-";
                  amountSuffix = "EUR";
                } else if (isGift) {
                  iconBg = "bg-green-100";
                  icon = <Gift className="w-5 h-5 text-green-600" />;
                  amountColor = "text-green-600";
                  amountPrefix = "-";
                  amountSuffix = "EUR";
                } else {
                  iconBg = "bg-[#2B7AB8]/10";
                  icon = <ArrowUpRight className="w-5 h-5 text-[#2B7AB8]" />;
                  amountColor = "text-[#1A1A1A]";
                  amountPrefix = "-";
                  amountSuffix = "UP";
                }

                return (
                  <div 
                    key={tx.id || idx}
                    className="bg-[#F5F5F5] rounded-xl p-4 flex items-center justify-between border border-black/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                        {icon}
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A1A] text-sm">
                          {tx.description || "Transazione"}
                        </p>
                        <p className="text-xs text-[#6B7280]">{tx.note || ""}</p>
                      </div>
                    </div>
                    <p className={`font-mono font-bold text-sm ${amountColor}`}>
                      {amountPrefix}{tx.amount?.toFixed(2)} {amountSuffix}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!user?.is_admin && <GiftCardSection onPurchase={fetchData} />}

        {/* Admin Links */}
        {user?.is_admin && (
          <div className="mt-4 mb-2 space-y-2">
            <Button
              onClick={() => navigate("/admin/giftcards")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-giftcards-btn"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin - Gift Card
            </Button>
            <Button
              onClick={() => navigate("/admin/users")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-users-btn"
            >
              <Users className="w-4 h-4 mr-2" />
              Admin - Utenti
            </Button>
            <Button
              onClick={() => navigate("/admin/openai")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-openai-btn"
            >
              <Bot className="w-4 h-4 mr-2" />
              Admin - Configurazione AI
            </Button>
            <Button
              onClick={() => navigate("/admin/content")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-content-btn"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin - Contenuti
            </Button>
            <Button
              onClick={() => navigate("/admin/features")}
              variant="outline"
              className="w-full h-12 rounded-xl border-[#1A1A1A] text-[#1A1A1A] font-semibold"
              data-testid="admin-features-btn"
            >
              <ToggleLeft className="w-4 h-4 mr-2" />
              Admin - Funzionalità & API
            </Button>
          </div>
        )}
      </div>

      <BottomNav active="home" unreadCount={unreadCount} />
    </div>
  );
}
