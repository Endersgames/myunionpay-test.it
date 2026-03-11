import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  ArrowLeft, Phone, MessageSquare, Wifi, 
  Calendar, CreditCard, RefreshCw, Copy, Eye, EyeOff,
  Send, ArrowDownUp, Plus, Banknote, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

// API
import { simAPI, walletAPI } from "@/lib/api";

// Circular Progress Component
const CircularProgress = ({ value, max, label, sublabel, color, isUnlimited }) => {
  const percentage = isUnlimited ? 100 : Math.min((value / max) * 100, 100);
  const remaining = isUnlimited ? "Illimitati" : `${(max - value).toFixed(max >= 100 ? 0 : 2)}`;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#E5E5E5" strokeWidth="5" />
          <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#1A1A1A]">
            {isUnlimited ? "∞" : remaining}
          </span>
        </div>
      </div>
      <p className="mt-1 font-medium text-xs text-[#1A1A1A]">{label}</p>
    </div>
  );
};

export default function SimDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sim, setSim] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showIban, setShowIban] = useState(false);
  
  // Dialogs
  const [showDeposit, setShowDeposit] = useState(false);
  const [showBonifico, setShowBonifico] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [bonificoData, setBonificoData] = useState({
    recipient_iban: "",
    recipient_name: "",
    amount: "",
    description: ""
  });
  const [processing, setProcessing] = useState(false);

  const cardNumber = sim?.phone_number ? 
    `4532 ${sim.phone_number.slice(-8, -4) || '1234'} ${sim.phone_number.slice(-4) || '5678'} ${Math.floor(1000 + Math.random() * 9000)}` :
    '4532 •••• •••• ••••';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [simData, walletData, txData] = await Promise.all([
        simAPI.getMySim(),
        walletAPI.getWallet(),
        simAPI.getTransactions().catch(() => [])
      ]);
      if (simData) {
        setSim(simData);
        setTransactions(txData);
      } else {
        navigate("/sim-activation");
      }
      setWallet(walletData);
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    setProcessing(true);
    try {
      const result = await simAPI.depositEur(amount);
      setSim(prev => ({ ...prev, eur_balance: result.new_balance }));
      toast.success(`Ricarica di €${amount.toFixed(2)} completata!`);
      setShowDeposit(false);
      setDepositAmount("");
      fetchData();
    } catch (err) {
      toast.error(err.message || "Errore nella ricarica");
    }
    setProcessing(false);
  };

  const handleBonifico = async () => {
    const amount = parseFloat(bonificoData.amount);
    if (!amount || amount <= 0 || !bonificoData.recipient_iban || !bonificoData.recipient_name) {
      toast.error("Compila tutti i campi");
      return;
    }
    setProcessing(true);
    try {
      const result = await simAPI.createBonifico({ ...bonificoData, amount });
      setSim(prev => ({ ...prev, eur_balance: result.new_balance }));
      toast.success(result.message);
      setShowBonifico(false);
      setBonificoData({ recipient_iban: "", recipient_name: "", amount: "", description: "" });
      fetchData();
    } catch (err) {
      toast.error(err.message || "Errore nel bonifico");
    }
    setProcessing(false);
  };

  const handleConvert = async () => {
    const amount = parseFloat(convertAmount);
    if (!amount || amount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    setProcessing(true);
    try {
      const result = await simAPI.convertToUp(amount);
      setSim(prev => ({ ...prev, eur_balance: result.new_eur_balance }));
      setWallet(prev => ({ ...prev, balance: result.new_up_balance }));
      toast.success(result.message);
      setShowConvert(false);
      setConvertAmount("");
      fetchData();
    } catch (err) {
      toast.error(err.message || "Errore nella conversione");
    }
    setProcessing(false);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiato!`);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#2B7AB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sim) return null;

  const eurBalance = sim.eur_balance || 0;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-safe">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] text-white px-6 pt-8 pb-6">
        <button 
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-white/60 hover:text-white mb-4"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Profilo</span>
        </button>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold">Conto UP</h1>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500">Attivo</span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="px-6 -mt-2">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-[#6B7280] text-sm mb-1">Saldo Disponibile</p>
          <p className="font-mono text-4xl font-bold text-[#1A1A1A]">€ {eurBalance.toFixed(2)}</p>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Button
              onClick={() => setShowDeposit(true)}
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 border-[#2B7AB8]/30 hover:bg-[#2B7AB8]/10"
            >
              <Plus className="w-5 h-5 text-[#2B7AB8]" />
              <span className="text-xs">Ricarica</span>
            </Button>
            <Button
              onClick={() => setShowBonifico(true)}
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 border-[#E85A24]/30 hover:bg-[#E85A24]/10"
            >
              <Send className="w-5 h-5 text-[#E85A24]" />
              <span className="text-xs">Bonifico</span>
            </Button>
            <Button
              onClick={() => setShowConvert(true)}
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 border-green-500/30 hover:bg-green-500/10"
            >
              <ArrowDownUp className="w-5 h-5 text-green-600" />
              <span className="text-xs">→ UP</span>
            </Button>
          </div>
        </div>

        {/* IBAN Section */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#6B7280] text-sm">IBAN</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowIban(!showIban)} className="text-[#6B7280] hover:text-[#1A1A1A]">
                {showIban ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => copyToClipboard(sim.iban || '', 'IBAN')} className="text-[#6B7280] hover:text-[#1A1A1A]">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="font-mono text-sm text-[#1A1A1A]">
            {showIban ? (sim.iban || 'IT00X0000000000000000000000') : 'IT•• •••• •••• •••• •••• ••••'}
          </p>
        </div>

        {/* Card Preview */}
        <div className="bg-gradient-to-br from-[#2B7AB8] to-[#1E5F8A] rounded-2xl p-4 text-white shadow-lg relative overflow-hidden mb-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <img src="/logo.png" alt="UP" className="h-6" />
              <span className="text-xs text-white/60">DEBIT</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-base tracking-wider">
                {showCardNumber ? cardNumber : '•••• •••• •••• ' + cardNumber.slice(-4)}
              </span>
              <button onClick={() => setShowCardNumber(!showCardNumber)} className="text-white/60 hover:text-white">
                {showCardNumber ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex justify-between text-xs">
              <span className="uppercase">{user?.full_name}</span>
              <span>12/28</span>
            </div>
          </div>
        </div>

        {/* UP Wallet */}
        <div className="bg-[#E85A24]/10 rounded-2xl p-4 border border-[#E85A24]/20 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#6B7280] text-sm">Wallet UP</p>
              <p className="font-mono text-2xl font-bold text-[#E85A24]">{wallet?.balance?.toFixed(2) || '0.00'} UP</p>
            </div>
            <Banknote className="w-8 h-8 text-[#E85A24]" />
          </div>
        </div>

        {/* SIM Usage */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1A1A1A]">La tua SIM</h2>
            <span className="text-xs text-[#6B7280]">{sim.plan_name}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CircularProgress value={0} max={1} label="Minuti" sublabel="" color="#2B7AB8" isUnlimited={true} />
            <CircularProgress value={sim.sms_used} max={sim.sms_total} label="SMS" sublabel="" color="#E85A24" isUnlimited={false} />
            <CircularProgress value={sim.gb_used} max={sim.gb_total} label="GB" sublabel="" color="#10B981" isUnlimited={false} />
          </div>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="font-semibold text-[#1A1A1A] mb-3">Ultimi Movimenti</h2>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.amount > 0 || tx.type === 'deposit' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {tx.amount > 0 || tx.type === 'deposit' ? 
                        <ArrowDownLeft className="w-4 h-4 text-green-600" /> : 
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{tx.description}</p>
                      <p className="text-xs text-[#6B7280]">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold ${
                    tx.amount > 0 || tx.type === 'deposit' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {tx.amount > 0 || tx.type === 'deposit' ? '+' : ''}€{Math.abs(tx.amount || tx.eur_amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deposit Dialog */}
      <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ricarica Conto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Importo (€)</Label>
              <Input
                type="number"
                placeholder="100.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="h-12 text-lg font-mono"
              />
            </div>
            <div className="flex gap-2">
              {[50, 100, 200, 500].map((amt) => (
                <Button key={amt} variant="outline" size="sm" onClick={() => setDepositAmount(String(amt))}>
                  €{amt}
                </Button>
              ))}
            </div>
            <Button onClick={handleDeposit} disabled={processing} className="w-full h-12 bg-[#2B7AB8] hover:bg-[#236699]">
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Ricarica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bonifico Dialog */}
      <Dialog open={showBonifico} onOpenChange={setShowBonifico}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuovo Bonifico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>IBAN Destinatario</Label>
              <Input
                placeholder="IT00X0000000000000000000000"
                value={bonificoData.recipient_iban}
                onChange={(e) => setBonificoData(prev => ({ ...prev, recipient_iban: e.target.value.toUpperCase() }))}
                className="h-12 font-mono text-sm"
              />
            </div>
            <div>
              <Label>Nome Beneficiario</Label>
              <Input
                placeholder="Mario Rossi"
                value={bonificoData.recipient_name}
                onChange={(e) => setBonificoData(prev => ({ ...prev, recipient_name: e.target.value }))}
                className="h-12"
              />
            </div>
            <div>
              <Label>Importo (€)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={bonificoData.amount}
                onChange={(e) => setBonificoData(prev => ({ ...prev, amount: e.target.value }))}
                className="h-12 font-mono"
              />
            </div>
            <div>
              <Label>Causale</Label>
              <Input
                placeholder="Pagamento fattura"
                value={bonificoData.description}
                onChange={(e) => setBonificoData(prev => ({ ...prev, description: e.target.value }))}
                className="h-12"
              />
            </div>
            <p className="text-xs text-[#6B7280]">Saldo disponibile: €{eurBalance.toFixed(2)}</p>
            <Button onClick={handleBonifico} disabled={processing} className="w-full h-12 bg-[#E85A24] hover:bg-[#D14E1A]">
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Invia Bonifico"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to UP Dialog */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Converti in UP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#F5F5F5] rounded-xl p-4 text-center">
              <p className="text-sm text-[#6B7280]">Tasso di cambio</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">1 € = 1 UP</p>
            </div>
            <div>
              <Label>Importo da convertire (€)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                className="h-12 text-lg font-mono"
              />
            </div>
            {convertAmount && parseFloat(convertAmount) > 0 && (
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-sm text-[#6B7280]">Riceverai</p>
                <p className="text-2xl font-bold text-green-600">{parseFloat(convertAmount).toFixed(2)} UP</p>
              </div>
            )}
            <p className="text-xs text-[#6B7280]">Saldo EUR disponibile: €{eurBalance.toFixed(2)}</p>
            <Button onClick={handleConvert} disabled={processing} className="w-full h-12 bg-green-600 hover:bg-green-700">
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Converti in UP"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav active="profile" />
    </div>
  );
}
